import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import axios from 'axios';
import { serialize } from '../JSON';
import { BigIntWrap, ProofBytes, Output, Reference, UTxO, CreateWalletResponse, SendFundsResponse, SubmitTxResult, ClientCredentials, Settings } from '../Types'

/**
 * A wrapper for interaction with the backend.
 * @class
 */
export class Backend {
    private url: string
    private secret: string | null

    /**
     * Creates a new Backend object.
     * @param {string} url     - Backend's URL
     * @param {string} secret  - optional Backend's secret (API key)
     */
    constructor(url: string, secret: string | null = null) {
        this.url = url
        this.secret = secret
    }

    private headers(additional: Record<string, string> = {}) {
        if (Object.keys(additional).length === 0 && !this.secret) {
            return {}
        }
        const headers: Record<string, any> = {
            headers: additional
        }
        if (this.secret) {
            headers.headers['api-key'] = this.secret
        }
        return headers
    }

    /**
     * Get server settings including network and version information.
     * @async
     * @returns {Settings}
     */
    async settings(): Promise<Settings> {
        const { data } = await axios.get(`${this.url}/v0/settings`, this.headers())
        return data
    }

    /**
     * Get Google OAuth credentials
     * @async
     * @returns {ClientCredentials}
     */
    async credentials(): Promise<ClientCredentials> {
        const { data } = await axios.get(`${this.url}/v0/oauth/credentials`, this.headers())
        return data
    }

    /**
     * Return wallet's address by email. The wallet can be not initialised, i.e. this function will return the address for any email.
     * @async
     * @param {string} email
     * @returns {CSL.Address}
     */
    async walletAddress(email: string): Promise<CSL.Address> {
        const { data } = await axios.post(`${this.url}/v0/wallet/address`, {
            'email': email
        }, this.headers())

        return CSL.Address.from_bech32(data.address)
    }

    /**
     * Activate a Smart Wallet.
     * This will create a minting transaction which should be signed and submitted.
     * @async
     * @param {string} jwt    - Base64url-decoded Google JSON web token without signature
     * @param {string} payment_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @param {ProofBytes} proof_bytes   - Zero-knowledge proof that the user possesses a valid JWT
     * @returns {CreateWalletResponse}
     */
    async activateWallet(jwt: string, payment_key_hash: string, proof_bytes: ProofBytes): Promise<CreateWalletResponse> {
        const requestData = {
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes
        }

        const payload = serialize(requestData)

        const { data } = await axios.post(`${this.url}/v0/wallet/activate`, payload,
            this.headers({ 'Content-Type': 'application/json' })
        )

        const response: CreateWalletResponse = {
            address: CSL.Address.from_bech32(data.address),
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        }

        return response
    }

    /**
     * Activate a Smart Wallet and send funds from it.
     * This will create transaction which should be signed and submitted.
     * @async
     * @param {string} jwt    - Base64url-decoded Google JSON web token without signature
     * @param {string} payment_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @param {ProofBytes} proof_bytes   - Zero-knowledge proof that the user possesses a valid JWT
     * @param {Output[]} outs            - Transaction outputs (where to send funds)
     * @returns {CreateWalletResponse}
     */
    async activateAndSendFunds(jwt: string, payment_key_hash: string, proof_bytes: ProofBytes, outs: Output[]): Promise<CreateWalletResponse> {
        const requestData = {
            'jwt': jwt,
            'payment_key_hash': payment_key_hash,
            'proof_bytes': proof_bytes,
            'outs': outs,
        }

        const payload = serialize(requestData)

        const { data } = await axios.post(`${this.url}/v0/wallet/activate-and-send-funds`, payload,
            this.headers({ 'Content-Type': 'application/json' })
        )

        const response: CreateWalletResponse = {
            address: CSL.Address.from_bech32(data.address),
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        }

        return response
    }

    /**
     * Send funds from an activated Smart Wallet.
     * This will create transaction which should be signed and submitted.
     * @async
     * @param {string} email
     * @param {Output[]} outs            - Transaction outputs (where to send funds)
     * @param {string} payment_key_hash  - Token name (the hash of a public key used to initialise the wallet)
     * @returns {SendFundsResponse}
     */
    async sendFunds(email: string, outs: Output[], payment_key_hash: string): Promise<SendFundsResponse> {
        const requestData = {
            'email': email,
            'outs': outs,
            'payment_key_hash': payment_key_hash,
        }

        const payload = serialize(requestData)

        const { data } = await axios.post(`${this.url}/v0/wallet/send-funds`, payload,
            this.headers({ 'Content-Type': 'application/json' })
        )

        const response: SendFundsResponse = {
            transaction: data.transaction,
            transaction_fee: data.transaction_fee,
            transaction_id: data.transaction_id
        }

        return response
    }

    /**
     * Submit a CBOR-encoded transaction. 
     * @async
     * @param {string} transaction
     * @param {string[]} email_recipients
     * @returns {SubmitTxResult} - Transaction ID and email delivery errors, if any
     */
    async submitTx(transaction: string, email_recipients: string[] = [], sender?: string): Promise<SubmitTxResult> {
        const { data } = await axios.post(`${this.url}/v0/tx/submit`, {
            email_recipients: email_recipients,
            sender: sender,
            transaction: transaction
        }, this.headers())

        return {
            notifier_errors: data.notifier_errors,
            transaction_id: data.transaction_id
        }
    }

    /**
     * Add a witness to the transaction, submit it and notify recipients by email.
     * @async
     * @param {string} unsigned_transaction
     * @param {string} vkey_witness
     * @param {string[]} email_recipients
     * @returns {SubmitTxResult} - Transaction ID and email delivery errors, if any
     */
    async addVkeyAndSubmitTx(unsigned_transaction: string, vkey_witness: string, email_recipients: string[] = [], sender?: string): Promise<SubmitTxResult> {
        const { data } = await axios.post(`${this.url}/v0/tx/add-vkey-and-submit`, {
            unsigned_transaction: unsigned_transaction,
            vkey_witness: vkey_witness,
            email_recipients: email_recipients,
            sender: sender
        }, this.headers())

        return {
            notifier_errors: data.notifier_errors,
            transaction_id: data.transaction_id
        }
    }

    /**
     * Get all UTxOs held by an address 
     * @async
     * @param {CSL.Address} address
     * @returns {UTxO[]}
     */
    async addressUtxo(address: CSL.Address): Promise<UTxO[]> {
        const { data } = await axios.post(`${this.url}/v0/address/utxos`, [address.to_bech32()], this.headers())

        const result: UTxO[] = []

        for (let i = 0; i < data.length; i++) {
            const ref = data[i].ref
            const parts = ref.split("#")
            const reference: Reference = {
                transaction_id: parts[0],
                output_index: Number(parts[1])
            }

            const values: { [key: string]: BigIntWrap } = {}

            for (const key in data[i].value) {
                values[key] = new BigIntWrap(data[i].value[key])
            }

            const utxo: UTxO = {
                ref: reference,
                address: CSL.Address.from_bech32(data[i].address),
                value: values
            }
            result.push(utxo)
        }

        return result
    }
}
