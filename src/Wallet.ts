import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import { Backend } from './Backend';
import { UTxO, Output, BigIntWrap, SubmitTxResult, ProofBytes } from './Types';
import { Prover } from './Prover';
import { hexToBytes } from './Utils';

/**
 * We support Bech32 addresses and Gmail-locked smart contracts.
 */
export enum AddressType {
    Bech32 = 0,
    Email = 1
}

/**
 * Data required to initialise a wallet.
 * 
 *  data is Google JSON Web Token as a string
 *  rootKey is the private key to sign transactions (can be generated randomly)
 */
export interface WalletInitialiser {
    jwt: string;
    tokenSKey?: string;
}

/**
 * Describes the recipient of ADA
 * @property {AddressType} recipientType  - Type of wallet the recipient holds
 * @property {string} address             - Cardano address if recipientType is Bech32, email otherwise
 * @property {Asset} assets               - A dictionary of assets to send. For ADA, use 'lovelace' as the key. For other assets, use the format '<PolicyID>.<AssetName>'
 */
export class SmartTxRecipient {
    recipientType: AddressType;
    address: string;
    assets: Asset;

    constructor(recipientType: AddressType, address: string, assets: Asset) {
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
 * The Wallet which can be initialised with an email address.
 */
export class Wallet {
    private jwt!: string;
    private tokenSKey!: CSL.Bip32PrivateKey;
    private userId!: string;
    private activated: Boolean = false;
    private proof: ProofBytes | null = null;

    private backend: Backend;
    private prover: Prover;

    /**
     *  @param {Prover} prover                 - A Prover object for interaction with the prover
     *  @param {Backend} backend               - A Backend object for interaction with the backend
     *  @param {WalletInitialiser} initialiser - Data to initialise the wallet
     */
    constructor(backend: Backend, prover: Prover, initialiser: WalletInitialiser) {
        this.backend = backend;
        this.prover = prover;

        // At this point, we assume that userId is a valid email accessible by the user (i.e. the user was able to complete Google authentication).
        this.jwt = initialiser.jwt;

        const parts = this.jwt.split(".");
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        this.userId = payload.email;

        if (!initialiser.tokenSKey) {
            const prvKey = CSL.Bip32PrivateKey
                .generate_ed25519_bip32()
                .derive(harden(1852)) // purpose
                .derive(harden(1815)) // coin type
                .derive(harden(0)) // account #0
                .derive(0)
                .derive(0);
            this.tokenSKey = prvKey;
        } else {
            this.tokenSKey = CSL.Bip32PrivateKey.from_hex(initialiser.tokenSKey);
            this.activated = true;
        }
    }

    public async getProof(): Promise<void> {
        const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex();
        const parts = this.jwt.split(".");
        const header = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));

        const keyId = JSON.parse(header).kid;
        const matchingKey = await getMatchingKey(keyId);
        const signature = parts[2].replace(/-/g, '+').replace(/_/g, '/');
        const empi = {
            piPubE: b64ToBn(matchingKey.e.replace(/-/g, '+').replace(/_/g, '/')),
            piPubN: b64ToBn(matchingKey.n.replace(/-/g, '+').replace(/_/g, '/')),
            piSignature: b64ToBn(signature),
            piTokenName: new BigIntWrap("0x" + pubkeyHex)
        };

        this.proof = await this.prover.prove(empi);   
    }

    public getUserId(): string {
        return this.userId;
    }

    public updateBackend(backend: Backend) {
        this.backend = backend;
    }

    public updateProver(prover: Prover) {
        this.prover = prover;
    }

    /**
     * @async
     * Get the Cardano address for a gmail address
     */
    public async addressForGmail(gmail: string): Promise<CSL.Address> {
        return await this.backend.walletAddress(gmail);
    }

    /**
     * @async
     * Get the Wallet's address
     */
    public async getAddress(): Promise<CSL.Address> {
        return await this.addressForGmail(this.userId);
    }

    /**
     * @async
     * Get wallet's balance as an object with asset names as property names and amounts as their values.
     */
    public async getBalance(): Promise<Asset> {
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
    public getExtensions(): string[] {
        return [];
    }

    /**
     * @async
     * Get UTxOs held by the wallet 
     */
    public async getUtxos(): Promise<UTxO[]> {
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
    public async getUsedAddresses(): Promise<CSL.Address[]> {
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
    public async getUnusedAddresses(): Promise<CSL.Address[]> {
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
    public async getRewardAddresses(): Promise<CSL.Address[]> {
        return [];
    }

    /**
     * @async
     * Get wallet's change address (currently wallet's main address) 
     */
    public async getChangeAddress(): Promise<CSL.Address> {
        return await this.getAddress();
    }

    /**
     * Send funds from this wallet to a recipient.
     *
     * @async
     * @param {SmartTxRecipient} rec - A recipient with a Cardano or a email address
     */
    public async sendTo(rec: SmartTxRecipient): Promise<SubmitTxResult> {
        console.log(rec.recipientType);
        console.log(rec.address);
        console.log(rec.assets);

        let recipientAddress;

        if (rec.recipientType == AddressType.Email) {
            recipientAddress = await this.addressForGmail(rec.address);
        } else {
            recipientAddress = CSL.Address.from_bech32(rec.address);
        }

        // Prepare email recipients list
        const emailRecipients: string[] = [];
        if (rec.recipientType == AddressType.Email) {
            emailRecipients.push(rec.address);
        }

        let txHex;
        const outs: Output[] = [{ address: recipientAddress.to_bech32(), value: rec.assets }];

        if (this.activated) {
            const resp = await this.backend.sendFunds(this.userId, outs, this.tokenSKey.to_public().to_raw_key().hash().to_hex());
            txHex = resp.transaction;
        } else {
            const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex();
            const parts = this.jwt.split(".");
            const header = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
            const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            while (!this.proof) {
                await delay(5_000);
            }
            const resp = await this.backend.activateAndSendFunds(header + '.' + payload, pubkeyHex, this.proof as ProofBytes, outs);
            txHex = resp.transaction;
            
        }
        const transaction = CSL.FixedTransaction.from_bytes(hexToBytes(txHex));
        transaction.sign_and_add_vkey_signature(this.tokenSKey.to_raw_key());
        const signedTxHex = Array.from(new Uint8Array(transaction.to_bytes())).map(b => b.toString(16).padStart(2, '0')).join('');

        const submitTxResult = await this.backend.submitTx(signedTxHex, emailRecipients);
        this.activated = true;

        return submitTxResult;
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
