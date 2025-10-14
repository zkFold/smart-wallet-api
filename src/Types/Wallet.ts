import * as CSL from '@emurgo/cardano-serialization-lib-browser';

// Smart Wallet version
export type Version = 'v0'

/**
 * Data required to initialise a wallet.
 * 
 *  data is Google JSON Web Token as a string
 *  rootKey is the private key to sign transactions (can be generated randomly)
 */
export interface WalletInitialiser {
    jwt: string;
    tokenSKey?: string;
}

/** Events emitted by the Wallet object.
 * 
 *  'walletInitialized' - emitted when the wallet is successfully initialized
 *  'proofComputationComplete' - emitted when ZK proof computation is complete
 *  'transactionComplete' - emitted when a transaction is successfully completed
 *  'transactionFailed' - emitted when a transaction fails
 *  'walletLoggedOut' - emitted when the wallet is logged out
 */
export type WalletEvent =
    'walletInitialized'
  | 'proofComputationComplete'
  | 'transactionComplete'
  | 'transactionFailed'
  | 'walletLoggedOut'

/**
 * The recipient address types we support.
 */
export enum AddressType {
    Bech32 = 0,
    Email = 1
}

export interface TransactionRequest {
    recipient: string
    recipientType: AddressType
    asset: string
    amount: string
}

export interface TransactionResult {
  txId: string
  recipient: string
  isProofComputing?: boolean
}
