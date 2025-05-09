import * as CSL from '@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib';
import axios from 'axios';

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

    toJSON(): JSON {
        return JSON.rawJSON(this.int.toString()); 
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
    "proof1_bytes": string,
    "proof2_bytes": string,
    "s1_xi_int": BigIntWrap,
    "s2_xi_int": BigIntWrap,
    "t_xi'_int": BigIntWrap,
    "t_xi_int": BigIntWrap,
    "z1_xi'_int": BigIntWrap,
    "z2_xi'_int": BigIntWrap
}

export function parseProofBytes(json: string): ProofBytes {
    const unsafe = JSON.parse(json);

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

/**
 * A wrapper for interaction with the backend.
 * @class
 */
export class Backend {
    private url: string;
    private secret: string;

    /**
     * Creates a new Backend object.
     * @param {string} url     - Backend's URL
     * @param {string} secret  - optional Backend's secret (API key)
     */
    constructor(url: string, secret: string | null = null) {
        this.url = url;
        this.secret = secret;
    }

    private headers(additional = {}) {
        if (additional == {}) {
            return {}
        }
        const headers = {
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
    async submitTx(tx: string): Promise<string> {
        const { data } = await axios.post(`${this.url}/v0/tx/submit`, tx,
            this.headers({ "Content-Type": "application/json" })
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
}

