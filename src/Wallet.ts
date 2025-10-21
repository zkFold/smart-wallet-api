import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { Backend } from './Service/Backend'
import { UTxO, Output, BigIntWrap, SubmitTxResult, ProofBytes, AddressType, TransactionRequest, TransactionResult, ProofInput, SmartTxRecipient, Value } from './Types'
import { Prover } from './Service/Prover'
import { b64ToBn, harden, hexToBytes } from './Utils'
import { Storage } from './Service/Storage'
import { Session } from './Service/Session'
import { GoogleApi } from './Service/Google'

/**
 * The Wallet which can be initialised with an email address.
 */
export class Wallet extends EventTarget  {
    private jwt?: string
    private tokenSKey?: CSL.Bip32PrivateKey
    private userId?: string
    private activated: Boolean = false
    private proof: ProofBytes | null = null

    private storage: Storage
    private session: Session
    private googleApi: GoogleApi
    private backend: Backend
    private prover: Prover

    /**
     *  @param {Backend} backend                 - A Backend object for interaction with the backend
     *  @param {Prover} prover                   - A Prover object for interaction with the prover
     *  @param {GoogleApi} googleApi             - A GoogleApi object for interaction with Google OAuth
     */
    constructor(backend: Backend, prover: Prover, googleApi: GoogleApi) {
        super()
        this.storage = new Storage()
        this.session = new Session()
        this.googleApi = googleApi
        this.backend = backend
        this.prover = prover
    }

    public login(): void {
        // Generate state for OAuth flow
        const array = new Uint8Array(32)
        crypto.getRandomValues(array)
        const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
        this.session.saveState(state)

        // Redirect to Google OAuth
        const authUrl = this.googleApi.getAuthUrl(state)
        window.location.href = authUrl
    }

    public isLoggedIn(): boolean {
        return this.jwt !== undefined && this.tokenSKey !== undefined && this.userId !== undefined
    }

    public logout(): void {
        this.jwt = undefined
        this.tokenSKey = undefined
        this.userId = undefined
        this.activated = false
        this.proof = null

        // Clear any session data
        sessionStorage.clear()

        // Dispatch logout event
        this.dispatchEvent(new Event('walletLoggedOut'))
    }

    public async oauthCallback(callbackData: string): Promise<void> {
        // Redirect to root address
        window.history.replaceState({}, '', '/')

        // Get saved state
        const savedState = this.session.getState()
        this.session.removeState()

        // Parse URL parameters
        const params = new URLSearchParams(callbackData)

        // Validate state
        const state = params.get('state')
        if (state !== savedState) {
            throw new Error('State mismatch. Possible CSRF attack')
        }

        // Get authorization code
        const code = params.get('code')
        if (!code) {
            throw new Error('Missing authorization code')
        }

        // Get JWT token
        const jwt = await this.googleApi.getJWTFromCode(code)
        if (!jwt) {
            throw new Error('Failed to get JWT from authorization code')
        }

        // Set user ID
        this.userId = this.googleApi.getUserId(jwt)
        // Get Cardano address
        const address = await this.addressForGmail(this.userId).then((x: any) => x.to_bech32())
        
        // Check if there is an existing wallet for the same Cardano address
        const exitingWalletInit = this.storage.getWallet(address)
        if (exitingWalletInit) {
            // TODO: check if we have a UTxO with the token matching the existing wallet's tokenSKey

            this.jwt = exitingWalletInit.jwt
            this.tokenSKey = CSL.Bip32PrivateKey.from_hex(exitingWalletInit.tokenSKey as string)
            this.activated = true
        }
        else {
            this.jwt = jwt
            const prvKey = CSL.Bip32PrivateKey
                .generate_ed25519_bip32()
                .derive(harden(1852)) // purpose
                .derive(harden(1815)) // coin type
                .derive(harden(0)) // account #0
                .derive(0)
                .derive(0)
            this.tokenSKey = prvKey
            this.activated = false
            this.getProof()
        }

        // Dispatch wallet initialised event
        this.dispatchEvent(new Event('walletInitialized'))
    }

    private async getProof(): Promise<void> {
        if (!this.jwt || !this.tokenSKey) {
            throw new Error('Wallet is not initialised')
        }

        const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex()
        const keyId = this.googleApi.getKeyId(this.jwt)
        const matchingKey = await this.googleApi.getMatchingKey(keyId)
        if (!matchingKey) {
            throw new Error(`Failed to find matching Google cert for key ${keyId}`)
        }
        const signature = this.googleApi.getSignature(this.jwt)
        const empi: ProofInput = {
            piPubE: b64ToBn(matchingKey.e),
            piPubN: b64ToBn(matchingKey.n),
            piSignature: b64ToBn(signature),
            piTokenName: new BigIntWrap("0x" + pubkeyHex)
        }

        this.jwt = this.googleApi.stripSignature(this.jwt)
        this.proof = await this.prover.prove(empi)
    }

    public async checkTransactionStatus(txId: string, recipient: string): Promise<any> {
        try {
            const address = CSL.Address.from_bech32(recipient)
            const utxos = await this.backend.addressUtxo(address)

            for (const utxo of utxos) {
                if ((utxo as any).ref.transaction_id === txId) {
                    return { outcome: "success", data: utxo }
                }
            }

            return { outcome: "pending" }
        } catch (error) {
            console.error('Failed to check transaction status:', error)
            return { outcome: "failure", reason: error }
        }
    }

    public getUserId(): string {
        if (!this.userId) {
            throw new Error('Wallet is not initialised')
        }
        return this.userId
    }

    /**
     * @async
     * Get the Cardano address for a gmail address
     */
    public async addressForGmail(gmail: string): Promise<CSL.Address> {
        return await this.backend.walletAddress(gmail)
    }

    /**
     * @async
     * Get the Wallet's address
     */
    public async getAddress(): Promise<CSL.Address> {
        if (!this.userId) {
            throw new Error('Wallet is not initialised')
        }
        return await this.addressForGmail(this.userId)
    }

    /**
     * @async
     * Get wallet's balance as an object with asset names as property names and amounts as their values.
     */
    public async getBalance(): Promise<Value> {
        const utxos = await this.getUtxos()
        const value: Value = {}
        for (let i = 0; i < utxos.length; i++) {
            for (const key in utxos[i].value) {
                if (!(key in value)) {
                    value[key] = new BigIntWrap(0)
                }
                value[key].increase(utxos[i].value[key])
            }
        }
        return value
    }

    /**
     * Get extensions turned on in the wallet
     */
    public getExtensions(): string[] {
        return []
    }

    /**
     * @async
     * Get UTxOs held by the wallet 
     */
    public async getUtxos(): Promise<UTxO[]> {
        const address = await this.getAddress()
        let utxos: UTxO[] = []
        try {
            utxos = await this.backend.addressUtxo(address)
        } catch (err) {
            console.log("getUtxos()")
            console.log(err)
            utxos = []
        }
        return utxos
    }

    /**
     * @async
     * Get wallet's used addresses (currently only wallet's main address) 
     */
    public async getUsedAddresses(): Promise<CSL.Address[]> {
        const utxos = await this.getUtxos()
        const address = await this.getAddress()
        if (utxos.length == 0) {
            return []
        } else {
            return [address]
        }
    }

    /**
     * @async
     * Get wallet's unused addresses 
     */
    public async getUnusedAddresses(): Promise<CSL.Address[]> {
        const utxos = await this.getUtxos()
        const address = await this.getAddress()
        if (utxos.length == 0) {
            return [address]
        } else {
            return []
        }
    }

    /**
     * @async
     * Get wallet's reward addresses (currently none) 
     */
    public async getRewardAddresses(): Promise<CSL.Address[]> {
        return []
    }

    /**
     * @async
     * Get wallet's change address (currently wallet's main address) 
     */
    public async getChangeAddress(): Promise<CSL.Address> {
        return await this.getAddress()
    }

    public async sendTransaction(request: TransactionRequest): Promise<void> {
        try {
            if (!this.jwt || !this.tokenSKey || !this.userId) {
                throw new Error('There is no active wallet when sending transaction')
            }

            console.log(`Sending ${request.amount} ${request.asset} to ${request.recipient} using ${request.recipientType}`)

            // Create asset dictionary
            const assetDict: { [key: string]: BigIntWrap } = {}
            assetDict[request.asset] = new BigIntWrap(request.amount)

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

            // Get recipient address for tracking
            let recipientAddress: string
            if (request.recipientType === AddressType.Email) {
                recipientAddress = await this.addressForGmail(request.recipient).then((x: any) => x.to_bech32())
            } else {
                recipientAddress = request.recipient
            }

            // Navigate to success view immediately with proof computing state
            const initialResult: TransactionResult = {
                txId: 'Computing...', // Temporary value while computing
                recipient: recipientAddress,
                isProofComputing: true
            }
            this.dispatchEvent(new CustomEvent('transactionComplete', { detail: initialResult }))

            // Send transaction (this includes the proof computation)
            const txResponse = await this.sendTo(recipient)
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

            // Emit proof computation complete event
            const finalResult: TransactionResult = {
                txId,
                recipient: recipientAddress,
                isProofComputing: false
            }
            this.storage.saveWallet(await this.getAddress().then((x: any) => x.to_bech32()), {
                jwt: this.jwt,
                tokenSKey: this.tokenSKey.to_hex()
            })
            this.dispatchEvent(new CustomEvent('proofComputationComplete', { detail: finalResult }))

        } catch (error) {
            console.error('Transaction failed:', error)
            this.dispatchEvent(new CustomEvent('transactionFailed', { detail: error }))
            throw error
        }
    }

    /**
     * Send funds from this wallet to a recipient.
     *
     * @async
     * @param {SmartTxRecipient} rec - A recipient with a Cardano or a email address
     */
    public async sendTo(rec: SmartTxRecipient): Promise<SubmitTxResult> {
        if (!this.userId || !this.tokenSKey || !this.jwt) {
            throw new Error('Wallet is not initialised')
        }

        console.log(rec.recipientType)
        console.log(rec.address)
        console.log(rec.assets)

        let recipientAddress

        if (rec.recipientType == AddressType.Email) {
            recipientAddress = await this.addressForGmail(rec.address)
        } else {
            recipientAddress = CSL.Address.from_bech32(rec.address)
        }

        // Prepare email recipients list
        const emailRecipients: string[] = []
        if (rec.recipientType == AddressType.Email) {
            emailRecipients.push(rec.address)
        }

        let txHex
        const outs: Output[] = [{ address: recipientAddress.to_bech32(), value: rec.assets }]

        if (this.activated) {
            const resp = await this.backend.sendFunds(this.userId, outs, this.tokenSKey.to_public().to_raw_key().hash().to_hex())
            txHex = resp.transaction
        } else {
            const pubkeyHex = this.tokenSKey.to_public().to_raw_key().hash().to_hex()
            const parts = this.jwt.split(".")
            const header = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
            const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
            while (!this.proof) {
                await delay(5_000)
            }
            const resp = await this.backend.activateAndSendFunds(header + '.' + payload, pubkeyHex, this.proof as ProofBytes, outs)
            txHex = resp.transaction

        }
        const transaction = CSL.FixedTransaction.from_bytes(hexToBytes(txHex))
        transaction.sign_and_add_vkey_signature(this.tokenSKey.to_raw_key())
        const signedTxHex = Array.from(new Uint8Array(transaction.to_bytes())).map(b => b.toString(16).padStart(2, '0')).join('')

        const submitTxResult = await this.backend.submitTx(signedTxHex, emailRecipients)
        this.activated = true

        return submitTxResult
    }
}
