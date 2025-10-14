import { deserialize, serialize } from '../JSON'
import { Version, WalletInitialiser } from '../Types'

interface StorageI {
    version: Version
    // Activated wallets
    wallets: { [addr: string]: WalletInitialiser }
}

export class Storage {
  private readonly STORAGE_KEY = 'zkfold-smart-wallet'

  public saveWallet(addr: string, wallet: WalletInitialiser): void {
    const storage = this.getStorage()
    storage.wallets[addr] = wallet
    localStorage.setItem(this.STORAGE_KEY, serialize(storage))
  }

  public getWallet(addr: string): WalletInitialiser | null {
    const storage = this.getStorage()
    return storage.wallets[addr] ?? null
  }

  private getStorage(): StorageI {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
        const storage = deserialize(stored)
        if (storage) {
            return storage
        }
    }

    // Initialize empty storage if it doesn't exist or is corrupted
    const defaultStorage: StorageI = { version: 'v0', wallets: {} }
    localStorage.setItem(this.STORAGE_KEY, serialize(defaultStorage))
    return defaultStorage
  }
}
