import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import axios from 'axios';
import { serialize } from './JSON';
import { BigIntWrap, ProofBytes, Output, Reference, UTxO, CreateWalletResponse, SendFundsResponse, SubmitTxResult, ClientCredentials } from './Types'

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
     * @param {string} version - Version of the on=chain wallet script. Defaults to the most recent one 
     * @returns {CSL.Address}
     */
    async walletAddress(email: string, version: string = ''): Promise<CSL.Address> {
        let url: string;
        if (!version) {
            url = `${this.url}/v0/wallet/address`;
        } else {
            url = `${this.url}/v0/wallet/${version}/address`;
        }

        const { data } = await axios.post(url, {
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
     * @param {string} version    - Version of the on=chain wallet script. Defaults to the most recent one 
     * @returns {boolean}
     */
    async isWalletInitialised(email: string, pubKeyHash: string, version: string = ''): Promise<boolean> {
        let url: string;
        if (!version) {
            url = `${this.url}/v0/wallet/is-initialized`;
        } else {
            url = `${this.url}/v0/wallet/${version}/is-initialized`;
        }
        const { data } = await axios.post(url, {
            'email': email
        }, this.headers()
        );
        if (!data.is_initialized) {
            return false;
        }
        const tokenNames = data.is_initialized[1];
        for (let i = 0; i < tokenNames.length; i++) {
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
     * @param {string} version           - Version of the on=chain wallet script. Defaults to the most recent one 
     * @returns {CreateWalletResponse}
     */
    async createWallet(email: string, jwt: string, payment_key_hash: string, proof_bytes: ProofBytes, fund_address?: CSL.Address, version: string = ''): Promise<CreateWalletResponse> {
        const requestData = {
            'email': email,
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes,
            'fund_address': fund_address
        };

        const payload = serialize(requestData);

        let url: string;
        if (!version) {
            url = `${this.url}/v0/wallet/create`;
        } else {
            url = `${this.url}/v0/wallet/${version}/create`;
        }
        const { data } = await axios.post(url, payload,
            this.headers({ 'Content-Type': 'application/json' })
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
     * @param {string} version           - Version of the on=chain wallet script. Defaults to the most recent one 
     * @returns {CreateWalletResponse}
     */
    async createAndSendFunds(email: string, jwt: string, payment_key_hash: string, proof_bytes: ProofBytes, outs: Output[], version: string = ''): Promise<CreateWalletResponse> {
        const requestData = {
            'email': email,
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes,
            'outs': outs,
        };

        const payload = serialize(requestData);

        let url: string;
        if (!version) {
            url = `${this.url}/v0/wallet/create-and-send-funds`;
        } else {
            url = `${this.url}/v0/wallet/${version}/create-and-send-funds`;
        }

        const { data } = await axios.post(url, payload,
            this.headers({ 'Content-Type': 'application/json' })
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
     * @param {string} version           - Version of the on=chain wallet script. Defaults to the most recent one 
     * @returns {SendFundsResponse}
     */
    async sendFunds(email: string, outs: Output[], payment_key_hash: string, version: string = ''): Promise<SendFundsResponse> {
        const requestData = {
            'email': email,
            'outs': outs,
            'payment_key_hash': payment_key_hash,
        };

        const payload = serialize(requestData);

        let url: string;
        if (!version) {
            url = `${this.url}/v0/wallet/send-funds`;
        } else {
            url = `${this.url}/v0/wallet/${version}/send-funds`;
        }

        const { data } = await axios.post(url, payload,
            this.headers({ 'Content-Type': 'application/json' })
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
     * @returns {SubmitTxResult} - Transaction ID and email delivery errors, if any
     */
    async submitTx(tx: string, email_recipients: string[] = []): Promise<SubmitTxResult> {
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
        const { data } = await axios.post(`${this.url}/v0/address/utxos`, [address.to_bech32()], this.headers());

        const result: UTxO[] = [];

        for (let i = 0; i < data.length; i++) {
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
     * Get Google OAuth credentials 
     * @async
     * @param {string} clientName 
     * @returns {ClientCredentials}
     */
    async credentials(): Promise<ClientCredentials> {
        const { data } = await axios.get(`${this.url}/v0/oauth/credentials`, this.headers());
        return data;
    }

}
