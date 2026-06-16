import { deserialize, serialize } from '../JSON'
import { Version, SmartContractWalletInitialiser } from '../Types'

interface StorageI {
    version: Version
    // Activated wallets
    wallets: { [addr: string]: SmartContractWalletInitialiser }
}

export class Storage {
  private readonly STORAGE_KEY = 'zkfold-smart-wallet'

  /**
   * Saves the wallet initialiser for a given address to local storage.
   * @param {string} addr - The wallet address.
   * @param {SmartContractWalletInitialiser} wallet - The wallet initialiser data.
   */
  public saveWallet(addr: string, wallet: SmartContractWalletInitialiser): void {
    const storage = this.getStorage()
    storage.wallets[addr] = wallet
    localStorage.setItem(this.STORAGE_KEY, serialize(storage))
  }

  /**
   * Retrieves the wallet initialiser for a given address from local storage.
   * @param {string} addr - The wallet address.
   * @returns {SmartContractWalletInitialiser | null} - The wallet initialiser data or null if not found.
   */
  public getWallet(addr: string): SmartContractWalletInitialiser | null {
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
