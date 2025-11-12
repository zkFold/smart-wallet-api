import { serialize, deserialize } from '../JSON'

interface SessionI {
    oauth_state: string | null
}

export class Session {
  private readonly SESSION_KEY = 'zkfold-smart-wallet'

  /**
   * Saves the OAuth state parameter to session storage.
   * @param {string} state - The OAuth state parameter to save.
   */
  public saveState(state: string): void {
    const session = this.getSession()
    session.oauth_state = state
    sessionStorage.setItem(this.SESSION_KEY, serialize(session))
  }

  /**
   * Retrieves the OAuth state parameter from session storage.
   * @returns {string | null} - The OAuth state parameter or null if not found.
   */
  public getState(): string | null {
    const session = this.getSession()
    return session.oauth_state ?? null
  }

  /**
   * Removes the OAuth state parameter from session storage.
   */
  public removeState(): void {
    const session = this.getSession()
    session.oauth_state = null
    sessionStorage.setItem(this.SESSION_KEY, serialize(session))
  }

  private getSession(): SessionI {
    const stored = sessionStorage.getItem(this.SESSION_KEY)
    if (stored) {
        const session = deserialize(stored)
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
