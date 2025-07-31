import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import axios from 'axios';
import JSONbig from 'json-bigint';

/**
 * Wrapper for various integer types used in communication with the backend and CSL.
 * Provides a JSON representation unavailable for bignum.
 */
export class BigIntWrap {
    private int!: bigint; 

    constructor(num: string | number | bigint | CSL.BigNum) {
        if (typeof num == "string") {
            this.int = BigInt(num);
        } else if (typeof num == "number") {
            this.int = BigInt(num);
        } else if (typeof num == "bigint") {
            this.int = BigInt(num);
        } else {
            this.int = BigInt(num.toString());
        }
    }

    add(other: BigIntWrap): BigIntWrap {
        return new BigIntWrap(this.int + other.int);
    }

    increase(other: BigIntWrap): void {
        this.int += other.int; 
    }

    toString(): string {
        return this.int.toString();
    }

    toNumber(): number {
        return Number(this.int);
    }

    toBigInt(): bigint {
        return this.int;
    }

    toBigNum(): CSL.BigNum {
        return CSL.BigNum.from_str(this.int.toString());
    }

    toJSON(): string {
        return this.int.toString(); 
    }
}

/**
 *  ProofBytes used by Plonkup.
 *  This object will be sent to the backend as a proof that user possesses a valid JSON Web Token 
 *  and used in the script redeemer.
 */
export interface ProofBytes {
    "a_xi_int": BigIntWrap, 
    "b_xi_int": BigIntWrap,
    "c_xi_int": BigIntWrap,
    "cmA_bytes": string,
    "cmB_bytes": string,
    "cmC_bytes": string,
    "cmF_bytes": string,
    "cmH1_bytes": string,
    "cmH2_bytes": string,
    "cmQhigh_bytes": string,
    "cmQlow_bytes": string,
    "cmQmid_bytes": string,
    "cmZ1_bytes": string,
    "cmZ2_bytes": string,
    "f_xi_int": BigIntWrap,
    "h1_xi'_int": BigIntWrap,
    "h2_xi_int": BigIntWrap,
    "l1_xi": BigIntWrap,
    "l_xi": BigIntWrap,
    "proof1_bytes": string,
    "proof2_bytes": string,
    "s1_xi_int": BigIntWrap,
    "s2_xi_int": BigIntWrap,
    "t_xi'_int": BigIntWrap,
    "t_xi_int": BigIntWrap,
    "z1_xi'_int": BigIntWrap,
    "z2_xi'_int": BigIntWrap
}

export type ProofStatus = ProofBytes;

export function parseProofBytes(json: string): ProofBytes | null {
    console.log(json);
    let unsafe;
    if (typeof json === 'string') {
        const parser = JSONbig({ useNativeBigInt: true });
        unsafe = parser.parse(json);
    } else if (typeof json === "object") {
        unsafe = json;
    } else {
        return null;
    }

    const wrapped = {
        "a_xi_int": new BigIntWrap(unsafe.a_xi_int), 
        "b_xi_int": new BigIntWrap(unsafe.b_xi_int),
        "c_xi_int": new BigIntWrap(unsafe.c_xi_int),
        "cmA_bytes": unsafe.cmA_bytes,
        "cmB_bytes": unsafe.cmB_bytes,
        "cmC_bytes": unsafe.cmC_bytes,
        "cmF_bytes": unsafe.cmF_bytes,
        "cmH1_bytes": unsafe.cmH1_bytes,
        "cmH2_bytes": unsafe.cmH2_bytes,
        "cmQhigh_bytes": unsafe.cmQhigh_bytes,
        "cmQlow_bytes": unsafe.cmQlow_bytes,
        "cmQmid_bytes": unsafe.cmQmid_bytes,
        "cmZ1_bytes": unsafe.cmZ1_bytes,
        "cmZ2_bytes": unsafe.cmZ2_bytes,
        "f_xi_int": new BigIntWrap(unsafe.f_xi_int),
        "h1_xi'_int": new BigIntWrap(unsafe["h1_xi'_int"]),
        "h2_xi_int": new BigIntWrap(unsafe.h2_xi_int),
        "l1_xi": new BigIntWrap(unsafe.l1_xi),
        "l_xi": new BigIntWrap(unsafe.l_xi),
        "proof1_bytes": unsafe.proof1_bytes,
        "proof2_bytes": unsafe.proof2_bytes,
        "s1_xi_int": new BigIntWrap(unsafe.s1_xi_int),
        "s2_xi_int": new BigIntWrap(unsafe.s2_xi_int),
        "t_xi'_int": new BigIntWrap(unsafe["t_xi'_int"]),
        "t_xi_int":  new BigIntWrap(unsafe.t_xi_int),
        "z1_xi'_int": new BigIntWrap(unsafe["z1_xi'_int"]),
        "z2_xi'_int": new BigIntWrap(unsafe["z2_xi'_int"])
    };

    return wrapped; 
}

/**
 * Transaction output as expected by the backend.
 *
 * @property {string} address 
 * @property {Array}  datum
 * @property {object} value 
 *
 * @example
 *
 * { "address": "addr_test1qrsuhwqdhz0zjgnf46unas27h93amfghddnff8lpc2n28rgmjv8f77ka0zshfgssqr5cnl64zdnde5f8q2xt923e7ctqu49mg5",
 *    "datum": [
 *      "?"
 *    ],
 *    "value": {
 *      "ff80aaaf03a273b8f5c558168dc0e2377eea810badbae6eceefc14ef.474f4c44": 101,
 *      "lovelace": 22
 *    }
 * }
 */
export interface Output {
    address: string,
    datum?: string[],
    value: {
        [key: string]: BigIntWrap;
    }
}

/**
 * Transaction input reference containing transaction id and output index.
 *
 * @property {string} transaction_id 
 * @property {number} output_index
 *
 * Will be serialised to JSON as `${transaction_id}#${output_index}`. For example,
 * "4293386fef391299c9886dc0ef3e8676cbdbc2c9f2773507f1f838e00043a189#1"
 */
export interface Reference {
    transaction_id: string,
    output_index: number
}

/**
 * UTxO object containing transaction where it was created, address and assets.
 *
 * @param {Reference}   ref          - Transaction output reference
 * @param {CLS.Address} address      - UTxO address
 * @param {object}      value        - UTxO assets
 *
 * @example
 *
 * {
 *      "address": "addr_test1qrsuhwqdhz0zjgnf46unas27h93amfghddnff8lpc2n28rgmjv8f77ka0zshfgssqr5cnl64zdnde5f8q2xt923e7ctqu49mg5",
 *      "ref": {
 *          "transaction_id": "4293386fef391299c9886dc0ef3e8676cbdbc2c9f2773507f1f838e00043a189",
 *          "output_index": 1
 *      }
 *      "value": {
 *          "ff80aaaf03a273b8f5c558168dc0e2377eea810badbae6eceefc14ef.474f4c44": 101,
 *          "lovelace": 22
 *      }
 *  }
 */
export interface UTxO {
    ref: Reference,
    address: CSL.Address,
    value: {
        [key: string]: BigIntWrap;
    }
}

/**
 *  This object is sent by the backend upon successful initialisation of a Gmail-based wallet.
 *
 *  @property {CSL.Address} address         - The new wallet's address
 *  @property {string}      transaction     - Transaction to be signed and submitted to initialise the wallet
 *  @property {number}      transaction_fee - The expected fee of the wallet initialisation transaction
 *  @property {string}      transaction_id  - The ID of the wallet initialisation transaction
 */
export interface CreateWalletResponse {
    address: CSL.Address,
    transaction: string,
    transaction_fee: number,
    transaction_id: string
}

/**
 *  This object is sent by the backend upon a successful request to the /send_funds endpoint 
 *
 *  @property {string}      transaction     - Transaction to be signed and submitted 
 *  @property {number}      transaction_fee - The expected fee of the transaction
 *  @property {string}      transaction_id  - The ID of the transaction
 */
export interface SendFundsResponse {
    transaction: string,
    transaction_fee: number,
    transaction_id: string
}

export interface PublicKey {
    public_e: BigIntWrap,
    public_n: BigIntWrap,
    public_size: BigIntWrap
}

export interface BackendKey {
    pkbId: string,
    pkbPublic: PublicKey
}

export function parseBackendKeys(json: any[]): BackendKey[] {
    const result = [];
    const arrayLength = json.length;
    for (let i = 0; i < arrayLength; i++) {
        const safe = {
            pkbId: json[i].pkbId,
            pkbPublic: {
                public_e: new BigIntWrap(json[i].pkbPublic.public_e),
                public_n: new BigIntWrap(json[i].pkbPublic.public_n),
                public_size: new BigIntWrap(json[i].pkbPublic.public_size),
            }
        }
        result.push(safe);
    }
    return result;
}

export function parseProofStatus(json: string): ProofBytes | string {
    const parser = JSONbig({ useNativeBigInt: true });
    const unsafe = parser.parse(json);
    if (unsafe.tag == "Completed") {
        return parseProofBytes(unsafe.contents.presBytes) || "";
    }
    return unsafe.tag;
    
}

export interface ProofInput {
    piPubE: BigIntWrap,
    piPubN: BigIntWrap,
    piSignature: BigIntWrap,
    piTokenName: BigIntWrap,
}

/**
 * A wrapper for interaction with the backend.
 * @class
 */
export class Backend {
    private url: string;
    private secret: string | null;

    /**
     * Creates a new Backend object.
     * @param {string} url     - Backend's URL
     * @param {string} secret  - optional Backend's secret (API key)
     */
    constructor(url: string, secret: string | null = null) {
        this.url = url;
        this.secret = secret;
    }

    private headers(additional: Record<string, string> = {}) {
        if (Object.keys(additional).length === 0 && !this.secret) {
            return {}
        }
        const headers: Record<string, any> = {
            headers: additional
        }
        if (this.secret) {
            headers.headers['api-key'] = this.secret;
        }
        return headers;
    }


    /**
     * Return wallet's address by email. The wallet can be not initialised, i.e. this function will return the adress for any email.
     * @async
     * @param {string} email
     * @returns {CSL.Address}
     */
    async walletAddress(email: string): Promise<CSL.Address> {
        const { data } = await axios.post(`${this.url}/v0/wallet/address`, {
            'email': email
          }, this.headers() 
        );
        return CSL.Address.from_bech32(data.address);
    }

    /**
     * Check if a Gmail-based wallet has been initialised (i.e. the token minting transaction has been submitted).
     * @async
     * @param {string} email
     * @param {string} pubKeyHash - Token name (the hash of a public key used to initialise the wallet)
     * @returns {boolean}
     */
    async isWalletInitialised(email: string, pubKeyHash: string): Promise<boolean> {
        const { data } = await axios.post(`${this.url}/v0/wallet/is-initialized`, {
            'email': email
          }, this.headers() 
        );
        if (!data.is_initialized) {
            return false;
        }
        const tokenNames = data.is_initialized[1];
        for (let i=0; i<tokenNames.length; i++) {
            if (tokenNames[i] == pubKeyHash) {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a Gmail-based wallet.
     * This will create a minting transaction which should be signed and submitted.
     * @async
     * @param {string} email
     * @param {string} jwt    - Base64url-decoded Google JSON web token without signature
     * @param {string} paymenk_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @param {ProofBytes} proof_bytes   - Zero-knowledge proof that the user possesses a valid JWT
     * @param {CSL.Address} fund_address - Address which wll fund the transaction (defaults to the wallet's address)
     * @returns {CreateWalletResponse}
     */
    async createWallet(email: string, jwt: string, payment_key_hash: string, proof_bytes: ProofBytes, fund_address?: CSL.Address): Promise<CreateWalletResponse> {
        const { data } = await axios.post(`${this.url}/v0/wallet/create`, {
            'email': email,
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes,
            'fund_address': fund_address
          }, this.headers() 
        );

        const response: CreateWalletResponse = { 
            address: CSL.Address.from_bech32(data.address),
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        };

        return response;
    }

    /**
     * Create a Gmail-based wallet and send funds from it.
     * This will create transaction which should be signed and submitted.
     * @async
     * @param {string} email
     * @param {string} jwt    - Base64url-decoded Google JSON web token without signature
     * @param {string} paymenk_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @param {ProofBytes} proof_bytes   - Zero-knowledge proof that the user possesses a valid JWT
     * @param {Output[]} outs            - Transaction outputs (where to send funds)
     * @returns {CreateWalletResponse}
     */
    async createAndSendFunds(email: string, jwt: string, payment_key_hash: string, proof_bytes: ProofBytes, outs: Output[]): Promise<CreateWalletResponse> {
        const { data } = await axios.post(`${this.url}/v0/wallet/create-and-send-funds`, {
            'email': email,
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes,
            'outs': outs,
          }, this.headers() 
        );

        const response: CreateWalletResponse = { 
            address: CSL.Address.from_bech32(data.address),
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        };

        return response;
    }

    /**
     * This will create transaction which should be signed and submitted.
     * @async
     * @param {string} email
     * @param {Output[]} outs            - Transaction outputs (where to send funds)
     * @param {string} paymenk_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @returns {SendFundsResponse}
     */
    async sendFunds(email: string, outs: Output[], payment_key_hash: string): Promise<SendFundsResponse> {
        const { data } = await axios.post(`${this.url}/v0/wallet/send-funds`, {
            'email': email,
            'outs': outs,
            'payment_key_hash': payment_key_hash,
          }, this.headers() 
        );

        const response: SendFundsResponse = { 
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        };

        return response;
    }

    /**
     * Submit a CBOR-encoded transaction. 
     * @async
     * @param {string} tx
     * @returns {string} - Transaction ID
     */
    async submitTx(tx: string, email_recipients: string[] = []): Promise<string> {
        const { data } = await axios.post(`${this.url}/v0/tx/submit`, { email_recipients: email_recipients, tx: tx },
            this.headers()
        );
        
        return data;
    }

    /**
     * Get all UTxOs held by an address 
     * @async
     * @param {CSL.Address} address
     * @returns {UTxO[]}
     */
    async addressUtxo(address: CSL.Address): Promise<UTxO[]> {
        const { data } = await axios.post(`${this.url}/v0/utxo/addresses`, [address.to_bech32()], this.headers());
        
        const result: UTxO[] = [];

        for (let i=0; i<data.length; i++) {
            const ref = data[i].ref;
            const parts = ref.split("#");
            const reference: Reference = {
                transaction_id: parts[0],
                output_index: Number(parts[1])
            }

            const values: { [key: string]: BigIntWrap } = {}
            
            for (const key in data[i].value) {
                values[key] = new BigIntWrap(data[i].value[key]);
            }

            const utxo: UTxO = {
                ref: reference,
                address: CSL.Address.from_bech32(data[i].address),
                value: values 
            }
            result.push(utxo);
        }

        return result;
    }

    /**
     * Get all public keys held by the Backend 
     * @async
     * @returns {BackendKey[]}
     */
    async serverKeys(): Promise<BackendKey[]> {
        const { data } = await axios.get(`${this.url}/v0/wallet/keys`, this.headers());
        console.log(data);
        return parseBackendKeys(data);
    }

    /**
     * Browser-compatible crypto utilities
     */
    private browserCrypto = {
        bytesToHex(bytes: Uint8Array): string {
            return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    };

    /**
     * Submit a proof request to the Backend. It will return a Request ID which can be used to retrieve proof status
     * @async
     * @param {ProofInput} inputs for the expMod circuit: exponent, modulus, signature and token name
     * @returns {string} proof request ID
     */
    async requestProof(proofInput: ProofInput): Promise<string> {
        const keys = await this.serverKeys();

        //TODO: choose the freshest one if we end up implementing key rotation
        const key = keys[0];

        const payload = JSON.stringify(proofInput);

        // 1. Generate AES-256 key and IV using Web Crypto API
        const aesKey = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
        const iv = crypto.getRandomValues(new Uint8Array(16));     // 128-bit IV for AES-CBC

        // 2. AES encrypt the plaintext with AES-256-CBC and PKCS#7 padding
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            aesKey,
            { name: 'AES-CBC' },
            false,
            ['encrypt']
        );

        const payloadBytes = new TextEncoder().encode(payload);
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv },
            cryptoKey,
            payloadBytes
        );

        // 3. Prepend IV to the ciphertext
        const ivPlusCipher = new Uint8Array(iv.length + encryptedData.byteLength);
        ivPlusCipher.set(iv, 0);
        ivPlusCipher.set(new Uint8Array(encryptedData), iv.length);

        // 4. Import RSA public key and encrypt AES key
        // Note: Using RSA-OAEP instead of PKCS#1 v1.5 for browser compatibility
        const nBigInt = BigInt(key.pkbPublic.public_n.toString());
        const eBigInt = BigInt(key.pkbPublic.public_e.toString());
        
        // Convert BigInts to byte arrays for RSA key
        const nBytes = this.bigIntToBytes(nBigInt);
        const eBytes = this.bigIntToBytes(eBigInt);

        const publicKey = await crypto.subtle.importKey(
            'jwk',
            {
                kty: 'RSA',
                n: this.bytesToBase64Url(nBytes),
                e: this.bytesToBase64Url(eBytes),
                alg: 'RSA-OAEP-256',
                use: 'enc'
            },
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            false,
            ['encrypt']
        );

        // 5. Encrypt AES key using RSA-OAEP (browser-compatible alternative to PKCS#1 v1.5)
        const encryptedKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            aesKey
        );

        const proveRequest = {
            preqKeyId: key.pkbId,
            preqAES: this.browserCrypto.bytesToHex(new Uint8Array(encryptedKey)),
            preqPayload: this.browserCrypto.bytesToHex(ivPlusCipher)
        };

        const { data } = await axios.post(`${this.url}/v0/wallet/prove`, proveRequest, this.headers());

        return data;
    }

    private bigIntToBytes(bigInt: bigint): Uint8Array {
        const hex = bigInt.toString(16);
        const paddedHex = hex.length % 2 ? '0' + hex : hex;
        const bytes = new Uint8Array(paddedHex.length / 2);
        for (let i = 0; i < paddedHex.length; i += 2) {
            bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
        }
        return bytes;
    }

    private bytesToBase64Url(bytes: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...bytes));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Retrieve the status of a Proof Request 
     * @async
     * @param {string} Proof request ID 
     * @returns {ProofBytes | string} ProofBytes if the proof has finished or 'Pending' otherwise
     */
    async proofStatus(proofId: string): Promise<ProofStatus | string> {
        const { data } = await axios.post(`${this.url}/v0/wallet/proof-status`, proofId,
            // to prevent Axios from parsing the result and messing with numbers
            {...this.headers({ "Content-Type": "application/json"}), ...{responseType: 'text'}} 
        );
        return parseProofStatus(data);
    }

    /**
     * Obtain a Proof from the backend. Unlike requestProof(), this method waits for the proof completion 
     * @async
     * @param {ProofInput} inputs for the expMod circuit: exponent, modulus, signature and token name
     * @returns {ProofBytes} ZK proof bytes for the expMod circuit 
     */
    async prove(proofInput: ProofInput): Promise<ProofBytes> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const proofId = await this.requestProof(proofInput);

        while (true) {
            try {
                const response = await this.proofStatus(proofId);

                console.log(`Status: ${response}`);

                if (typeof response === 'object') {
                    return response;  
                }

                await delay(30_000);

            } catch (error) {
                console.error('Error checking status:', error);
                return null as any;
            }
        }

    }

}

