import { deserialize, serialize } from '../JSON'
import { MultiWalletStorage } from '../Types'
import { WalletInitialiser } from '../Wallet'

export class Storage {
  private readonly MULTI_WALLET_KEY = 'smart-wallets'
  private readonly SESSION_KEY = 'smart-wallet-session'

  // Multi-wallet support with persistent credentials
  public saveWallet(addr: string, wallet: WalletInitialiser): void {
    try {
      const multiWallet = this.getMultiWalletStorage()
      multiWallet.wallets[addr] = wallet
      localStorage.setItem(this.MULTI_WALLET_KEY, serialize(multiWallet))
    } catch (error) {
      console.warn('Failed to save wallet to localStorage:', error)
    }
  }

  public getWallet(addr: string): WalletInitialiser | null {
    try {
      const multiWallet = this.getMultiWalletStorage()
      return multiWallet.wallets[addr] || null
    } catch (error) {
      console.warn('Failed to retrieve wallet from localStorage:', error)
      return null
    }
  }

  public getAllWallets(): WalletInitialiser[] {
    try {
      const multiWallet = this.getMultiWalletStorage()
      return Object.values(multiWallet.wallets)
    } catch (error) {
      console.warn('Failed to retrieve wallets from localStorage:', error)
      return []
    }
  }

  public removeWallet(addr: string): void {
    try {
      const multiWallet = this.getMultiWalletStorage()
      delete multiWallet.wallets[addr]
      localStorage.setItem(this.MULTI_WALLET_KEY, serialize(multiWallet))
    } catch (error) {
      console.warn('Failed to remove wallet from localStorage:', error)
    }
  }

  public removeAllWallets(): void {
    try {
      localStorage.removeItem(this.MULTI_WALLET_KEY)
    } catch (error) {
      console.warn('Failed to remove all wallets from localStorage:', error)
    }
  }

  private getMultiWalletStorage(): MultiWalletStorage {
    try {
      const stored = localStorage.getItem(this.MULTI_WALLET_KEY)
      if (stored) {
        return deserialize(stored)
      } else {
        // Initialize empty storage if it doesn't exist
        const defaultStorage: MultiWalletStorage = { wallets: {} }
        localStorage.setItem(this.MULTI_WALLET_KEY, serialize(defaultStorage))
        return defaultStorage
      }
    } catch (error) {
      console.warn('Failed to parse multi-wallet storage:', error)
      const defaultStorage: MultiWalletStorage = { wallets: {} }
      localStorage.setItem(this.MULTI_WALLET_KEY, serialize(defaultStorage))
      return defaultStorage
    }
  }
}
