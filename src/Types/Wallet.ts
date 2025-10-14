import { BigIntWrap } from "./Common";

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

/**
 * Describes assets and their amounts
 */
export interface Asset {
    [key: string]: BigIntWrap
}

/**
 * Describes the recipient of ADA
 * @property {AddressType} recipientType  - Type of wallet the recipient holds
 * @property {string} address             - Cardano address if recipientType is Bech32, email otherwise
 * @property {Asset} assets               - A dictionary of assets to send. For ADA, use 'lovelace' as the key. For other assets, use the format '<PolicyID>.<AssetName>'
 */
export interface SmartTxRecipient {
    recipientType: AddressType
    address: string
    assets: Asset
}