import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { UTxO, TransactionRequest, BalanceResponse, Transaction, AddressType, SmartTxRecipient } from './Types'
import { CIP30Wallet } from './CIP30Wallet'
import { Storage } from './Service/Storage'
import { harden } from './Utils'
import { Backend } from './Service/Backend'

export class SeedphraseWallet extends EventTarget implements CIP30Wallet {
    private storage: Storage

    private rootKey: CSL.Bip32PrivateKey;    
    private accountKey: CSL.Bip32PrivateKey; 

    private backend: Backend;
    private networkId!: number; 

    private lastUsedAddress: number;

    /**
     *  @param {Backend} backend         - A Backend object for communication with Cardano
     *  @param {string} seedphrase       - Seedphrase of the wallet 
     *  @param {string} password         - Optional password
     *  @param {string} network          - Accepted values: 'mainnet', 'preprod', 'preview'
     */
    constructor(backend: Backend, seedphrase: string, password: string = '', network: string = 'mainnet') {
        super()

        this.backend = backend;

        this.storage = new Storage();

        switch (network) {
            case "mainnet": {
                this.networkId = CSL.NetworkInfo.mainnet().network_id();
                break;
            };
            case "preprod": {
                this.networkId = CSL.NetworkInfo.testnet_preprod().network_id();
                break;
            };
            case "preview": {
                this.networkId = CSL.NetworkInfo.testnet_preview().network_id();
                break;
            };
        };
        
        const entropy = bip39.mnemonicToEntropy(seedphrase, wordlist);
        this.rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
              Buffer.from(entropy, 'hex'),
              Buffer.from(password),
            );
        this.accountKey = this.rootKey
          .derive(harden(1852)) // purpose
          .derive(harden(1815)) // coin type
          .derive(harden(0)); // account #0

        this.lastUsedAddress = 0;
    }

    private generateAddress(ix: number): CSL.Address {
        const utxoPubKey = this.accountKey
          .derive(0) // external
          .derive(ix)
          .to_public();
        
        const stakeKey = this.accountKey
          .derive(2) // chimeric
          .derive(ix)
          .to_public();

        const paymentCred = CSL.Credential.from_keyhash(utxoPubKey.to_raw_key().hash());
        const stakeCred = CSL.Credential.from_keyhash(stakeKey.to_raw_key().hash());
        const baseAddr = CSL.BaseAddress.new(
          this.networkId,
          paymentCred,
          stakeCred,
        );

        return baseAddr.to_address();
    }

    private getUsedAddressesSync(): CSL.Address[] {
        const usedAddresses = []
        for (let i = 0; i <= this.lastUsedAddress; i++) {
            usedAddresses.push(this.generateAddress(i))
        }
        return usedAddresses
    }

    /**
     * @async
     * Get the Wallet's address
     */
    getAddress(): Promise<CSL.Address> {
        return new Promise((resolve, reject) => resolve(this.generateAddress(0)))
    }

    /**
     * @async
     * Get an unused address for the wallet 
     */
    getUnusedAddress(): Promise<CSL.Address> {
        this.lastUsedAddress += 1;
        return new Promise((resolve, reject) => resolve(this.generateAddress(this.lastUsedAddress)))
    }

    /**
     * @async
     * Get wallet's balance as an object with asset names as property names and amounts as their values.
     */
    async getBalance(): Promise<BalanceResponse> {
        const usedAddresses = this.getUsedAddressesSync() 
        const balance = await this.backend.balance(usedAddresses)
        return balance
    }

    /**
     * @async
     * Get the approximate USD value of all wallet's assets 
     */
    async getUSDValue(): Promise<number> {
        const balance = await this.getBalance()
        return balance.usd
    }

    /**
     * @async
     * Get wallet's transaction history 
     */
    async getTxHistory(): Promise<Transaction[]> {
        const usedAddresses = this.getUsedAddressesSync() 
        return await this.backend.txHistory(usedAddresses)
    }

    /**
     * Get extensions turned on in the wallet
     */
    getExtensions(): string[] {
        return []
    }

    /**
     * @async
     * Get UTxOs held by the wallet 
     */
    async getUtxos(): Promise<UTxO[]> {
        const usedAddresses = this.getUsedAddressesSync() 
        let utxos: UTxO[] = []
        try {
            for (let i = 0; i < usedAddresses.length; i++) {
                const addrUtxos = await this.backend.addressUtxo(usedAddresses[i])
                utxos = utxos.concat(addrUtxos)
            }
        } catch (err) {
            console.log("getUtxos()")
            console.log(err)
            utxos = []
        }
        return utxos
    }

    /**
     * @async
     * Get wallet's used addresses 
     */
    getUsedAddresses(): Promise<CSL.Address[]> {
        return new Promise((resolve, reject) => resolve(this.getUsedAddressesSync()))
    }

    /**
     * @async
     * Get wallet's unused addresses 
     */
    async getUnusedAddresses(): Promise<CSL.Address[]> {
        const unused = await this.getUnusedAddress()
        return [unused] // TODO: return a batch of these addresses? 
    }

    /**
     * @async
     * Get wallet's reward addresses 
     */
    getRewardAddresses(): Promise<CSL.Address[]> {
        const utxoPubKey = this.accountKey
          .derive(0) // external
          .derive(0)
          .to_public();
        
        const paymentCred = CSL.Credential.from_keyhash(utxoPubKey.to_raw_key().hash());
        const rewardAddr = CSL.RewardAddress.new(
          this.networkId,
          paymentCred,
        );

        return new Promise((resolve, reject) => resolve([rewardAddr.to_address()]));
    }

    /**
     * @async
     * Get wallet's change address (currently wallet's main address) 
     */
    async getChangeAddress(): Promise<CSL.Address> {
        return await this.getAddress()
    }

    /**
     * @async
     * Send a transaction from this wallet.
     *
     * @param {TransactionRequest} request - Transaction request object
     */
    async sendTransaction(request: TransactionRequest): Promise<void> {
        this.dispatchEvent(new CustomEvent('transaction_initiated', { detail: true }))
        console.log(`Sending ${request.amount} ${request.asset} to ${request.recipient} using ${request.recipientType}`)

        // Create recipient
        let recipient: SmartTxRecipient
        switch (request.recipientType) {
            case AddressType.Bech32:
                recipient = { recipientType: AddressType.Bech32, address: request.recipient, assets: assetDict }
                break
            case AddressType.Email:
                recipient = { recipientType: AddressType.Email, address: request.recipient, assets: assetDict }
                break
            default:
                throw new Error(`Unsupported recipient type: ${request.recipientType}`)
        }

        let recipientAddress

        if (recipient.recipientType == AddressType.Email) {
            recipientAddress = await this.addressForGmail(recipient.address)
        } else {
            recipientAddress = CSL.Address.from_bech32(recipient.address)
        }    

        const utxos = await this.getUtxos();

        const txBuilderCfg = 
            CSL.TransactionBuilderConfigBuilder.new()
            .fee_algo(
                CSL.LinearFee.new(
                CSL.BigNum.from_str("44"),
                CSL.BigNum.from_str("155381")
            )
            )
            .coins_per_utxo_byte(CSL.BigNum.from_str("4310"))
            .pool_deposit(CSL.BigNum.from_str("500000000"))
            .key_deposit(CSL.BigNum.from_str("2000000"))
            .max_value_size(5000)
            .max_tx_size(16384)
            .prefer_pure_change(true)
            .ex_unit_prices(CSL.ExUnitPrices.new(
               CSL.UnitInterval.new(
                 CSL.BigNum.from_str("577"),
                 CSL.BigNum.from_str("10000")
               ),
               CSL.UnitInterval.new(
                 CSL.BigNum.from_str("721"),
                 CSL.BigNum.from_str("10000000")
               )
             ))
            .build();
        
        const txBuilder = CSL.TransactionBuilder.new(txBuilderCfg);

        const txInputBuilder = CSL.TxInputsBuilder.new();

        utxos.forEach((utxo) => {
            if (utxo.value['lovelace'] != null) {
                const ada = utxo.value['lovelace'];
                const hash = CSL.TransactionHash.from_bytes(Buffer.from(utxo.ref.transaction_id, "hex"))
                const input = CSL.TransactionInput.new(hash, utxo.ref.output_index);
                const value = CSL.Value.new(ada.toBigNum());
                const addr = utxo.address;
                txInputBuilder.add_regular_input(addr, input, value);
            }
        });

        txBuilder.set_inputs(txInputBuilder);

        const output = CSL.TransactionOutput.new(
                recipientAddress,
                CSL.Value.new(amountToSend),
        );

        txBuilder.add_output(output);

        txBuilder.add_change_if_needed(senderAddress);

        const txBody = txBuilder.build(); 

        const transaction = CSL.FixedTransaction.new_from_body_bytes(txBody.to_bytes());
        transaction.sign_and_add_vkey_signature(this.accountKey.derive(0).derive(0).to_raw_key());
        
        const signedTxHex = Buffer.from(transaction.to_bytes()).toString('hex');
        const txResponse = await this.backend.submitTx(signedTxHex);

        const txId = txResponse.transaction_id;
        const failedEmails = txResponse.notifier_errors;
        console.log(`Transaction ID: ${txId}`)
        if (failedEmails && failedEmails.length > 0) {
            console.error('Notifier errors occurred:');
            for (let i = 0; i < failedEmails.length; i++) {
                const failedNotification = failedEmails[i];
                console.error(`Failed to notify recipient ${failedNotification.email}: ${failedNotification.error}`);
            }
        }
        this.dispatchEvent(new CustomEvent('transaction_pending', { detail: request }))


        this.awaitTxConfirmed(txId, recipientAddress.to_bech32())
    }        

    protected async awaitTxConfirmed(txId: string, recipient: string): Promise<void> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        while (true) {
            const response = await this.checkTransactionStatus(txId, recipient)

            if (response.outcome === "success") {
                this.dispatchEvent(new CustomEvent('transaction_confirmed', { detail: response.data }))
                return
            } else if (response.outcome === "failure") {
                this.dispatchEvent(new CustomEvent('transaction_failed', { detail: response.reason }))
                return
            }

            await delay(30_000)
        }
    }

    protected async checkTransactionStatus(txId: string, recipient: string): Promise<any> {
        try {
            const address = CSL.Address.from_bech32(recipient)
            const utxos = await this.backend.addressUtxo(address)

            for (const utxo of utxos) {
                if ((utxo as any).ref.transaction_id === txId) {
                    return { outcome: "success", data: txId }
                }
            }

            return { outcome: "pending" }
        } catch (error) {
            console.error('Failed to check transaction status:', error)
            return { outcome: "failure", reason: error }
        }
    }
}            
             
             
             
             
             
             
             
