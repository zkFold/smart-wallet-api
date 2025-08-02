import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Backend, UTxO, Output, BigIntWrap } from './Backend';
import { initialiseWASI, mkProofBytesMock } from './WASM';
import { BufferUtils, hexToBytes } from './Utils';

/**
 * Supported Cardano networks
 */
export type Network = 'Preview' | 'Preprod' | 'Mainnet';

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
 * Wallet configuration options for browser/extension compatibility
 */
export interface WalletOptions {
    wasmUrl?: string; // Custom WASM URL for browser extensions
}

/**
 * Describes the recipient of ADA
 * @property {WalletType} recipientType  - Type of wallet the recipient holds
 * @property {string} address            - Cardano address if recipientType is Mnemonic, email otherwise
 * @property {Asset} assets              - A dictionary of assets to send. For ADA, use 'lovelace' as the key. For other assets, use the format '<PolicyID>.<AssetName>'
 */
export class SmartTxRecipient {
    recipientType: WalletType;
    address: string;
    assets: Asset;

    constructor(recipientType: WalletType, address: string, assets: Asset) {
        this.recipientType = recipientType;
        this.address = address;
        this.assets = assets;
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
    private network: Network;
    private wasmUrl?: string;

    /**
     *  @param {Backend} backend         - A Backend object for communication with Cardano
     *  @param {Initialiser} initialiser - Data to initialise the wallet
     *  @param {string} password         - Optional password
     *  @param {Network} network         - Accepted values: 'Mainnet', 'Preprod', 'Preview'
     *  @param {WalletOptions} options   - Browser/extension compatibility options
     */
    constructor(backend: Backend, initialiser: Initialiser, password: string = '', network: Network = 'Mainnet', options: WalletOptions = {}) {
        this.backend = backend;
        this.network = network;
        this.method = initialiser.method;
        this.wasmUrl = options.wasmUrl;

        if (this.method == WalletType.Mnemonic) {
            const entropy = bip39.mnemonicToEntropy(initialiser.data, wordlist);
            this.rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
                BufferUtils.from(entropy, 'hex'),
                BufferUtils.from(password),
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
                    case "Mainnet": {
                        netId = CSL.NetworkInfo.mainnet().network_id();
                        break;
                    };
                    case "Preprod": {
                        netId = CSL.NetworkInfo.testnet_preprod().network_id();
                        break;
                    };
                    case "Preview": {
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
        for (let i = 0; i < utxos.length; i++) {
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
     * Get UTxOs held by the wallet 
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
    private async buildTx(senderAddress: CSL.Address, recipientAddress: CSL.Address, assets: Asset): Promise<CSL.TransactionBuilder> {
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
                const hash = CSL.TransactionHash.from_bytes(BufferUtils.from(utxo.ref.transaction_id, "hex"))
                const input = CSL.TransactionInput.new(hash, utxo.ref.output_index);
                const value = CSL.Value.new(ada.toBigNum());
                const addr = utxo.address;
                txInputBuilder.add_regular_input(addr, input, value);
            }
        });
        txBuilder.set_inputs(txInputBuilder);

        for (const [key, value] of Object.entries(assets)) {
            if (key == 'lovelace') {
                const output = CSL.TransactionOutput.new(
                    recipientAddress,
                    CSL.Value.new(value.toBigNum()),
                );
                txBuilder.add_output(output);
            } else {
                const parts = key.split(".");
                const policyId = parts[0];
                const assetName = parts[1];
                const assets = CSL.Assets.new();
                assets.insert(
                    CSL.AssetName.new(hexToBytes(assetName)),
                    value.toBigNum(),
                );
                const masset = CSL.MultiAsset.new();
                masset.insert(CSL.ScriptHash.from_hex(policyId), assets);
                const output = CSL.TransactionOutput.new(
                    recipientAddress,
                    CSL.Value.new_with_assets(value.toBigNum(), masset),
                );
                txBuilder.add_output(output);
            }
        }

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
        console.log(rec.assets);


        const senderAddress = await this.getAddress();
        let recipientAddress;

        if (rec.recipientType == WalletType.Google) {
            recipientAddress = await this.addressForGmail(rec.address);
        } else {
            recipientAddress = CSL.Address.from_bech32(rec.address);
        }

        switch (this.method) {
            case WalletType.Mnemonic: {
                // A classical transaction from an address behind a private key to another address or a smart contract
                const txBuilder = await this.buildTx(senderAddress, recipientAddress, rec.assets);

                const txBody = txBuilder.build();

                const transaction = CSL.FixedTransaction.new_from_body_bytes(txBody.to_bytes());
                transaction.sign_and_add_vkey_signature(this.accountKey.derive(0).derive(0).to_raw_key());

                const signedTxHex = Array.from(new Uint8Array(transaction.to_bytes())).map(b => b.toString(16).padStart(2, '0')).join('');
                return await this.backend.submitTx(signedTxHex);
            };

            case WalletType.Google: {
                // A transaction from a Web2-initialised wallet to any kind of address
                const is_initialised = await this.backend.isWalletInitialised(this.userId, this.tokenSKey.to_public().to_raw_key().hash().to_hex());
                console.log(`Is initialised: ${is_initialised}`);
                let txHex;

                const outs: Output[] = [{ address: recipientAddress.to_bech32(), value: rec.assets }];

                if (is_initialised && !this.freshKey) {
                    const resp = await this.backend.sendFunds(this.userId, outs, this.tokenSKey.to_public().to_raw_key().hash().to_hex());
                    txHex = resp.transaction;
                } else {
                    const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex();
                    console.log(pubkeyHex);
                    const parts = this.jwt.split(".");
                    const header = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
                    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));

                    const keyId = JSON.parse(header).kid;
                    const matchingKey = await getMatchingKey(keyId);
                    const signature = parts[2].replace(/-/g, '+').replace(/_/g, '/');
                    const empi = {
                        piPubE: b64ToBn(matchingKey.e.replace(/-/g, '+').replace(/_/g, '/')),
                        piPubN: b64ToBn(matchingKey.n.replace(/-/g, '+').replace(/_/g, '/')),
                        piSignature: b64ToBn(signature),
                        piTokenName: new BigIntWrap("0x" + pubkeyHex)
                    };

                    //const instance = await initialiseWASI();
                    //const proofBytes = mkProofBytesMock(instance, 0n, new Array(19).fill(0n), empi);
                    const proofBytes = await this.backend.prove(empi);

                    const resp = await this.backend.createAndSendFunds(this.userId, header + '.' + payload, pubkeyHex, proofBytes, outs);
                    txHex = resp.transaction;
                }
                const transaction = CSL.FixedTransaction.from_bytes(hexToBytes(txHex));
                transaction.sign_and_add_vkey_signature(this.tokenSKey.to_raw_key());
                const signedTxHex = Array.from(new Uint8Array(transaction.to_bytes())).map(b => b.toString(16).padStart(2, '0')).join('');

                return await this.backend.submitTx(signedTxHex);
            };
        };
    }

}

function harden(num: number): number {
    return 0x80000000 + num;
}

async function getMatchingKey(keyId: string) {
    const { keys } = await fetch('https://www.googleapis.com/oauth2/v3/certs').then((res) => res.json());
    for (const k of keys) {
        if (k.kid == keyId) {
            return k;
        }
    }
    return null;
}


// https://coolaj86.com/articles/bigints-and-base64-in-javascript/
function b64ToBn(b64: string): BigIntWrap {
    const bin = atob(b64);
    const hex: string[] = [];

    bin.split('').forEach(function (ch) {
        let h = ch.charCodeAt(0).toString(16);
        if (h.length % 2) { h = '0' + h; }
        hex.push(h);
    });

    return new BigIntWrap(BigInt('0x' + hex.join('')));
}
