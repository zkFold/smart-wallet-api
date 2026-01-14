import * as CSL from '@emurgo/cardano-serialization-lib-asmjs'
import { Backend } from './Service/Backend'
import { WalletInitialiser } from './Types'
import { Prover } from './Service/Prover'
import { harden } from './Utils'
import { GoogleApi } from './Service/Google'
import { AbstractWallet } from './AbstractWallet'
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english'

/**
 * The Wallet which can be initialised with an email address.
 */
export class PopupWallet extends AbstractWallet {

    /**
     *  @param {Backend} backend                 - A Backend object for interaction with the backend
     *  @param {Prover} prover                   - A Prover object for interaction with the prover
     *  @param {GoogleApi} googleApi             - A GoogleApi object for interaction with Google OAuth
     */
    constructor(backend: Backend, prover: Prover, googleApi: GoogleApi) {
        super(backend, prover, googleApi)
    }

    public login(): void {
        chrome.runtime.sendMessage({
            action: 'AUTH'
        }).catch((error) => {
            console.error("Error sending message to background script:", error);
        });
    }

    protected getWallet(addr: string): Promise<WalletInitialiser | null> {
        return chrome.storage.local.get(['walletStorage']).then((res) => {
            const wallets = res?.walletStorage as { [addr: string]: WalletInitialiser } | undefined;
            console.log("Retrieved wallets from storage:", wallets);
            return wallets?.[addr] ?? null;
        });
    }

    protected saveState(state: string): void {
        chrome.storage.local.set({
            oauth_state: state
        })
    }

    protected saveWallet(addr: string, wallet: WalletInitialiser): void {
        chrome.storage.local.get(['walletStorage'], (res) => {
            const version = res.version;
            let wallets = res.wallets as { [addr: string]: WalletInitialiser };
            wallets[addr] = wallet;
            chrome.storage.local.set({
                version: version,
                walletStorage: wallets
            })
        })

    }

    public logout(): void {
        this.jwt = undefined
        this.tokenSKey = undefined
        this.userId = undefined
        this.activated = false
        this.proof = null

        chrome.storage.local.clear();

        // Dispatch logout event
        this.dispatchEvent(new CustomEvent('logged_out'))
    }

    protected oauthCallback(callbackData: string): Promise<void> {
        return this.oauthCallbackAsync(callbackData);
    }

    private async oauthCallbackAsync(callbackData: string): Promise<void> {
        const params = new URLSearchParams(callbackData)

        const code = params.get('code')
        if (!code) {
            throw new Error('Missing authorization code in my code')
        }
        const jwt = await this.googleApi.getJWTFromCode(code);
        if (!jwt) {
            throw new Error('Failed to get JWT from authorization code')
        }
        // Set user ID
        this.userId = this.googleApi.getUserId(jwt)

        // Get Cardano address
        const address = await this.addressForGmail(this.userId).then((x: any) => x.to_bech32())

        // Check if there is an existing wallet for the same Cardano address
        const exitingWalletInit = await this.getWallet(address)
        if (exitingWalletInit) {
            // TODO: check if we have a UTxO with the token matching the existing wallet's tokenSKey
            this.jwt = exitingWalletInit.jwt
            this.tokenSKey = CSL.Bip32PrivateKey.from_hex(exitingWalletInit.tokenSKey as string)
            this.activated = true
        }
        else {
            console.log("No existing wallet found, creating new wallet.")
            this.jwt = jwt
            const mnemonic = bip39.generateMnemonic(wordlist);
            const entropy = bip39.mnemonicToEntropy(mnemonic, wordlist);
            const rootKey = CSL.Bip32PrivateKey.from_bip39_entropy(
                entropy,
                new Uint8Array(),
            );

            const prvKey = rootKey
                .derive(harden(1852)) // purpose
                .derive(harden(1815)) // coin type
                .derive(harden(0)) // account #0
                .derive(0)
                .derive(0)

            this.tokenSKey = prvKey
            this.activated = false
            this.getProof()
        }
        chrome.storage.local.set({
            jwt: this.jwt,
            tokenSKey: this.tokenSKey.to_hex(),
            userId: this.userId
        }, () => {
            console.log('Save credentials to storage');
        });

        this.dispatchEvent(new CustomEvent('initialized'))
    }
}
