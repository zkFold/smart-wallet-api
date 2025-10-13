import { deserialize, serialize } from '../JSON'
import { SmartWalletStorage } from '../Types'
import { WalletInitialiser } from '../Wallet'

export class Storage {
  private readonly SMART_WALLET_STORAGE_KEY = 'zkfold-smart-wallet'

  public saveWallet(addr: string, wallet: WalletInitialiser): void {
    const smartWallet = this.getSmartWalletStorage()
    smartWallet.wallets[addr] = wallet
    localStorage.setItem(this.SMART_WALLET_STORAGE_KEY, serialize(smartWallet))
  }

  public getWallet(addr: string): WalletInitialiser | null {
    const smartWallet = this.getSmartWalletStorage()
    return smartWallet.wallets[addr] ?? null
  }

  private getSmartWalletStorage(): SmartWalletStorage {
    const stored = localStorage.getItem(this.SMART_WALLET_STORAGE_KEY)
    if (stored) {
        const storage = deserialize(stored);
        if (storage) {
            return storage
        }
    }

    // Initialize empty storage if it doesn't exist or is corrupted
    const defaultStorage: SmartWalletStorage = { version: 'v0', wallets: {} }
    localStorage.setItem(this.SMART_WALLET_STORAGE_KEY, serialize(defaultStorage))
    return defaultStorage
  }
}
