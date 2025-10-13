import { serialize, deserialize } from '../JSON';

interface SessionI {
    oauth_state: string | null
}

export class Session {
  private readonly SESSION_KEY = 'zkfold-smart-wallet'

  public saveSessionState(state: string): void {
    const smartWallet = this.getSession()
    smartWallet.oauth_state = state
    sessionStorage.setItem(this.SESSION_KEY, serialize(smartWallet))
  }

  public getSessionState(): string | null {
    const smartWallet = this.getSession()
    return smartWallet.oauth_state ?? null
  }

  private getSession(): SessionI {
    const stored = sessionStorage.getItem(this.SESSION_KEY)
    if (stored) {
        const session = deserialize(stored);
        if (session) {
            return session
        }
    }

    // Initialize empty session if it doesn't exist or is corrupted
    const defaultStorage: SessionI = { oauth_state: null }
    sessionStorage.setItem(this.SESSION_KEY, serialize(defaultStorage))
    return defaultStorage
  }
}
