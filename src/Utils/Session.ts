import { serialize, deserialize } from '../JSON';

export class Session {
  private readonly SESSION_KEY = 'smart-wallet-session'

  public saveSessionData(key: string, data: any): void {
    try {
      const sessionData = this.getSessionData()
      sessionData[key] = data
      sessionStorage.setItem(this.SESSION_KEY, serialize(sessionData))
    } catch (error) {
      console.warn('Failed to save session data:', error)
    }
  }

  public getSessionData(): any {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY)
      return stored ? deserialize(stored) : {}
    } catch (error) {
      console.warn('Failed to retrieve session data:', error)
      return {}
    }
  }

  public getSessionItem(key: string): any {
    const sessionData = this.getSessionData()
    return sessionData[key]
  }

  public removeSessionItem(key: string): void {
    try {
      const sessionData = this.getSessionData()
      delete sessionData[key]
      sessionStorage.setItem(this.SESSION_KEY, serialize(sessionData))
    } catch (error) {
      console.warn('Failed to remove session item:', error)
    }
  }
}
