import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { UTxO, TransactionRequest, BalanceResponse, Transaction } from './Types'
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
    
    }
}
