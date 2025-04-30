import * as CSL from '@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Backend, UTxO, ProofBytes, Output, BigIntWrap } from './Backend';

/**
 * Whether the wallet was initialised with a mnemonic or with Gmail.
 */
export enum WalletType {
    Mnemonic = 0,
    Google = 1
}

/**
 * Data required to initialise a wallet.
 * 
 * When method is WalletType.Mnemonic:
 *  data is the mnemonic
 *  rootKey is not required
 *
 * When method is WalletType.Google:
 *  data is Google JSON Web Token as a string
 *  rootKey is the private key to sign transactions (can be generated randomly)
 */
export interface Initialiser {
    method: WalletType;
    data: string;
    rootKey?: string; 
}

/**
 * Describes the recipient of ADA
 * @property {WalletType} recipientType  - Type of wallet the recipient holds
 * @property {string} address            - Cardano address if recipientType is Mnemonic, email otherwise
 * @property {BigIntWrap} amount         - amount of lovelace to send
 */
export class SmartTxRecipient {
    recipientType: WalletType;
    address: string;
    amount: BigIntWrap;

    constructor(recipientType: WalletType, address: string, amount: BigIntWrap) {
        this.recipientType = recipientType;
        this.address = address;
        this.amount = amount;
    }
}

/**
 * Describes assets and their amounts
 */
export interface Asset {
    [key: string]: BigIntWrap;
}

/**
 * The Wallet which can be initialised with a mnemonic or a email address.
 */
export class Wallet {
    private rootKey!: CSL.Bip32PrivateKey;    // Only for Mnemonic
    private accountKey!: CSL.Bip32PrivateKey; // Only for Mnemonic
    private utxoPubKey!: CSL.Bip32PublicKey;  // Only for Mnemonic
    private stakeKey!: CSL.Bip32PublicKey;    // Only for Mnemonic

    private tokenSKey!: CSL.Bip32PrivateKey;  // Only for Google 
    private jwt!: string;        // Only for Google 
    private userId!: string;     // Only for Google 
    private freshKey: boolean = false;

    private backend: Backend; 
    private method: WalletType;
    private network: string;

    /**
     *  @param {Backend} backend         - A Backend object for communication with Cardano
     *  @param {Initialiser} initialiser - Data to initialise the wallet
     *  @param {string} password         - Optional password
     *  @param {string} network          - Accepted values: 'mainnet', 'preprod', 'preview'
     */
    constructor(backend: Backend, initialiser: Initialiser, password: string = '', network: string = 'mainnet') {
        this.backend = backend;
        this.network = network;
        this.method = initialiser.method;
        
        if (this.method == WalletType.Mnemonic) {
            const entropy = bip39.mnemonicToEntropy(initialiser.data, wordlist);
            this.rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
                  Buffer.from(entropy, 'hex'),
                  Buffer.from(password),
                );
            this.deriveKeys();
        } else {
            // At this point, we assume that userId is a valid email accessible by the user (i.e. the user was able to complete Google authentication).
            this.jwt = initialiser.data; 

            const parts = this.jwt.split(".");
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            this.userId = payload.email;

            if (!initialiser.rootKey) {
                const prvKey = CSL.Bip32PrivateKey
                      .generate_ed25519_bip32()
                      .derive(harden(1852)) // purpose
                      .derive(harden(1815)) // coin type
                      .derive(harden(0)) // account #0
                      .derive(0)
                      .derive(0);
                this.tokenSKey = prvKey;
                this.freshKey = true;
            } else {
                this.tokenSKey = CSL.Bip32PrivateKey.from_hex(initialiser.rootKey);
            }
        }
    }

    /**
     * For a mnemonic-based wallet, derive all necessary keys
     *
     * Adapted from https://developers.cardano.org/docs/get-started/cardano-serialization-lib/generating-keys/
     */
    private deriveKeys(): void {
        if (this.method == WalletType.Google) {
            return;
        }
        this.accountKey = this.rootKey
          .derive(harden(1852)) // purpose
          .derive(harden(1815)) // coin type
          .derive(harden(0)); // account #0
        
        this.utxoPubKey = this.accountKey
          .derive(0) // external
          .derive(0)
          .to_public();
        
        this.stakeKey = this.accountKey
          .derive(2) // chimeric
          .derive(0)
          .to_public();
    }

    /**
     * @async
     * Get the Cardano address for a gmail address
     */
    async addressForGmail(gmail: string): Promise<CSL.Address> {
        return await this.backend.walletAddress(gmail);
    }

    /**
     * @async
     * Get the Wallet's address 
     * Adapted from https://developers.cardano.org/docs/get-started/cardano-serialization-lib/generating-keys/
     */
    async getAddress(): Promise<CSL.Address> {
        switch (this.method) {
            case WalletType.Mnemonic: {
                const paymentCred = CSL.Credential.from_keyhash(this.utxoPubKey.to_raw_key().hash()); 
                let netId: number = 0;
                switch (this.network) {
                    case "mainnet": {
                        netId = CSL.NetworkInfo.mainnet().network_id();
                        break;
                    };
                    case "preprod": {
                        netId = CSL.NetworkInfo.testnet_preprod().network_id();
                        break;
                    };
                    case "preview": {
                        netId = CSL.NetworkInfo.testnet_preview().network_id();
                        break;
                    };
                };
                // cardano-serialization-lib does not support base addresses without staking credentials.
                // This is required when initialising the wallet with email
                // I'll create an Enterprise address instead for now.
                const baseAddr = CSL.EnterpriseAddress.new(
                  netId,
                  paymentCred,
                );
                
                return baseAddr.to_address()
            };
            case WalletType.Google: {
                return await this.addressForGmail(this.userId);  
            };
        }
    }

    /**
     * @async
     * Get wallet's balance as an object with asset names as property names and amounts as their values.
     */
    async getBalance(): Promise<Asset> {
        const utxos = await this.getUtxos();
        const assets: Asset = {};
        for (let i=0; i < utxos.length; i++) {
            for (const key in utxos[i].value) {
                if (!(key in assets)) {
                    assets[key] = new BigIntWrap(0);
                }
                assets[key].increase(utxos[i].value[key]);
            }
        };
        return assets;
    }

    /**
     * Get extensions turned on in the wallet
     */
    getExtensions(): string[] {
        return [];
    }

    /**
     * @async
     * Get UTxO held by the wallet 
     */
    async getUtxos(): Promise<UTxO[]> {
        const address = await this.getAddress();
        let utxos: UTxO[] = [];
        try {
            utxos = await this.backend.addressUtxo(address); 
        } catch (err) {
            console.log("getUtxos()");
            console.log(err);
            utxos = [];
        }
        return utxos;
    }

    /**
     * @async
     * Get wallet's used addresses (currently only wallet's main address) 
     */
    async getUsedAddresses(): Promise<CSL.Address[]> {
        const utxos = await this.getUtxos();
        const address = await this.getAddress();
        if (utxos.length == 0) {
            return [];
        } else {
            return [address];
        }
    }
    
    /**
     * @async
     * Get wallet's unused addresses 
     */
    async getUnusedAddresses(): Promise<CSL.Address[]> {
        const utxos = await this.getUtxos();
        const address = await this.getAddress();
        if (utxos.length == 0) {
            return [address];
        } else {
            return [];
        }
    }

    /**
     * @async
     * Get wallet's reward addresses (currently none) 
     */
    async getRewardAddresses(): Promise<CSL.Address[]> {
        return [];
    }

    /**
     * @async
     * Get wallet's change address (currently wallet's main address) 
     */
    async getChangeAddress(): Promise<CSL.Address> {
        return await this.getAddress();
    }

    /**
     * Build a transaction to send funds from a sender to the recipient.
     * Works only for transactions between Cardano addresses.
     *
     * @async
     * @param {CSL.Address} senderAddress    - A Cardano address of the sender
     * @param {CSL.Address} recipientAddress - A Cardano address of the recipient
     * @param {CSL.Address} recipientAddress - A Cardano address of the recipient
     */
    private async buildTx(senderAddress: CSL.Address, recipientAddress: CSL.Address, amountToSend: CSL.BigNum): Promise<CSL.TransactionBuilder> {
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
        
        return txBuilder;
    }

    /**
     * Send funds from this wallet to a recipient.
     *
     * @async
     * @param {SmartTxRecipient} rec - A recipient with a Cardano or a gmail address
     */
    async sendTo(rec: SmartTxRecipient): Promise<string> {
        console.log(this.method);
        console.log(rec.recipientType);
        console.log(rec.address);
        console.log(rec.amount);


        const senderAddress = await this.getAddress();
        let recipientAddress;

        if (rec.recipientType == WalletType.Google) {
            recipientAddress = await this.addressForGmail(rec.address);
        } else {
            recipientAddress = CSL.Address.from_bech32(rec.address); 
        }

        const amountToSend = rec.amount;

        switch (this.method) {
            case WalletType.Mnemonic: {
                // A classical transaction from an address behind a private key to another address or a smart contract
                const txBuilder = await this.buildTx(senderAddress, recipientAddress, amountToSend.toBigNum());

                const txBody = txBuilder.build(); 

                const transaction = CSL.FixedTransaction.new_from_body_bytes(txBody.to_bytes());
                transaction.sign_and_add_vkey_signature(this.accountKey.derive(0).derive(0).to_raw_key());
                
                const signedTxHex = Buffer.from(transaction.to_bytes()).toString('hex');
                return await this.backend.submitTx(signedTxHex);
            };

            case WalletType.Google: {
                // A transaction from a Web2-initialised wallet to any kind of address
                const is_initialised = await this.backend.isWalletInitialised(this.userId, this.tokenSKey.to_public().to_raw_key().hash().to_hex());
                console.log(`Is initialised: ${is_initialised}`);
                let txHex;

                const outs: Output[] = [{address: recipientAddress.to_bech32(), value: { 'lovelace': amountToSend }}];

                if (is_initialised && !this.freshKey) {
                    const resp = await this.backend.sendFunds(this.userId, outs, this.tokenSKey.to_public().to_raw_key().hash().to_hex());
                    txHex = resp.transaction;
                } else {
                    const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex();
                    const parts = this.jwt.split(".");
                    const header  = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
                    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
                    const resp = await this.backend.createAndSendFunds(this.userId, header + '.' + payload, pubkeyHex, dummyProofBytes, outs);
                    txHex = resp.transaction;
                }
                const transaction = CSL.FixedTransaction.from_bytes(hexToBytes(txHex));
                transaction.sign_and_add_vkey_signature(this.tokenSKey.to_raw_key());
                const signedTxHex = Buffer.from(transaction.to_bytes()).toString('hex');

                return await this.backend.submitTx(signedTxHex);
            };
        };
    }

}

// Convert a hex string to a byte array
// https://stackoverflow.com/questions/14603205/how-to-convert-hex-string-into-a-bytes-array-and-a-bytes-array-in-the-hex-strin
function hexToBytes(hex: string): Uint8Array {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return Uint8Array.from(bytes);
}

function harden(num: number): number {
  return 0x80000000 + num;
}


const dummyProofBytes: ProofBytes = {
    "cmA_bytes": "393766316433613733313937643739343236393536333863346661396163306663333638386334663937373462393035613134653361336631373162616335383663353565383366663937613161656666623361663030616462323263366262",
    "cmB_bytes": "393766316433613733313937643739343236393536333863346661396163306663333638386334663937373462393035613134653361336631373162616335383663353565383366663937613161656666623361663030616462323263366262",
    "cmC_bytes": "623132333661356332663866323965333635663338343538666239353634653265613666383530343165666163663837303739613734353664383631333261643233313232313262636463613364373830656430393537396532383537343135",
    "cmF_bytes": "633030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030",
    "cmH1_bytes": "633030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030",
    "cmH2_bytes": "633030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030",
    "cmZ1_bytes": "613935316661346136366334386264623634366438376337313738336635646362386633616138313231393536346564383336393633333863336266633135366635353031643466323636613763393235386565343563303233313862646537",
    "cmZ2_bytes": "393766316433613733313937643739343236393536333863346661396163306663333638386334663937373462393035613134653361336631373162616335383663353565383366663937613161656666623361663030616462323263366262",
    "cmQlow_bytes": "623033346330653239383838636436383633333834356266633037376565636163326238636164623539663535303436303630393664306637643331383837323734373737643632303234363538343737303538626562373735366662656236",
    "cmQmid_bytes": "623462313730313934386435643265333665313838393533346365373534346133636331623736303461323465386464633636316233653936623161616239303638373466393461303436343761633563633232386561376563363638356136",
    "cmQhigh_bytes": "633030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030",
    "proof1_bytes": "623330386335373739363436313936383535306632386432333833396166373237323361333130383332363332613139653961623531326134613565636234633863383935306164653032353737323439353032323231333736396133663464",
    "proof2_bytes": "623365343262343835303035643963326261346136366466626234646566323433336439326137623166643734376566346165643462356635653934343037396264653739616431646135383035333539376234626538313934373233666331",
    "a_xi_int":  new BigIntWrap(1n),
    "b_xi_int":  new BigIntWrap(1n),
    "c_xi_int":  new BigIntWrap(48380510586722627616411267202495116783057255243693228940120047704204371350546n),
    "s1_xi_int": new BigIntWrap(10368790864104277489349149849901642613910605061180645600781012523028298814297n),
    "s2_xi_int": new BigIntWrap(29133202091870269236732546656522855889661645594339077247007036693772071783753n),
    "f_xi_int":  new BigIntWrap(0n),
    "t_xi_int":  new BigIntWrap(0n),
    "t_xi'_int": new BigIntWrap(0n),
    "z1_xi'_int": new BigIntWrap(40497370593942275679614638124878515092846558874156949013549943373738078556493n),
    "z2_xi'_int": new BigIntWrap(1n),
    "h1_xi'_int": new BigIntWrap(0n),
    "h2_xi_int":  new BigIntWrap(0n),
    "l1_xi": new BigIntWrap(37713268627753681891487380051493928725054683102581668523304176199511429320989n)
};

