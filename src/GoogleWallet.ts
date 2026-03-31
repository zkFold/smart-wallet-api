import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { Backend } from './Service/Backend'
import { SmartContractWalletInitialiser } from './Types'
import { Prover } from './Service/Prover'
import { harden } from './Utils'
import { Storage } from './Service/Storage'
import { Session } from './Service/Session'
import { GoogleApi } from './Service/Google'
import { AbstractGoogleWallet } from './AbstractGoogleWallet'

/**
 * The Wallet which can be initialised with an email address.
 */
export class GoogleWallet extends AbstractGoogleWallet {
    public storage: Storage
    public session: Session

    /**
     *  @param {Backend} backend                 - A Backend object for interaction with the backend
     *  @param {Prover} prover                   - A Prover object for interaction with the prover
     *  @param {GoogleApi} googleApi             - A GoogleApi object for interaction with Google OAuth
     */
    constructor(backend: Backend, prover: Prover, googleApi: GoogleApi) {
        super(backend, prover, googleApi)
        this.storage = new Storage()
        this.session = new Session()
    }

    public login(): void {
        window.location.href = this.createUrl()
    }

    protected getWallet(addr: string): Promise<SmartContractWalletInitialiser | null> {
        return Promise.resolve(this.storage.getWallet(addr));
    }

    protected saveWallet(addr: string, wallet: SmartContractWalletInitialiser): void {
        this.storage.saveWallet(addr, wallet);
    }

    protected saveState(state: string): void {
        this.session.saveState(state);
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
        this.dispatchEvent(new CustomEvent('logged_out'))
    }

    private async oauthCallbackAsync(callbackData: string): Promise<void> {

        console.log("OAuth callback")
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
        const exitingSmartContractWalletInit = this.storage.getWallet(address)
        if (exitingSmartContractWalletInit) {
            // TODO: check if we have a UTxO with the token matching the existing wallet's tokenSKey

            this.jwt = exitingSmartContractWalletInit.jwt
            this.tokenSKey = CSL.Bip32PrivateKey.from_hex(exitingSmartContractWalletInit.tokenSKey as string)
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
        this.dispatchEvent(new CustomEvent('initialized'))
    }

    public oauthCallback(callbackData: string): Promise<void> {
        return this.oauthCallbackAsync(callbackData);
    }

}
