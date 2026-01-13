import * as CSL from '@emurgo/cardano-serialization-lib-asmjs'
import { Backend } from './Service/Backend'
import { UTxO, Output, BigIntWrap, SubmitTxResult, ProofBytes, AddressType, TransactionRequest, ProofInput, SmartTxRecipient, BalanceResponse, Transaction, WalletInitialiser } from './Types'
import { Prover } from './Service/Prover'
import { b64ToBn, harden, hexToBytes } from './Utils'
import { Storage } from './Service/Storage'
import { Session } from './Service/Session'
import { GoogleApi } from './Service/Google'
import { AbstractWallet } from './AbstractWallet'

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
        // window.location.href = this.createUrl()[1]
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

        // Clear any session data
        chrome.storage.local.clear();

        // Dispatch logout event
        this.dispatchEvent(new CustomEvent('logged_out'))
    }
}
