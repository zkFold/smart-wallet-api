import * as CSL from '@emurgo/cardano-serialization-lib-browser';

/**
 * Smart Wallet Backend settings
 */
export interface Settings {
    network: string
    version: string
}

/**
 *  OAuth client credentials 
 *
 *  @property {string}      client_id         - OAuth client id
 *  @property {string}      client_secret     - OAuth client secret
 */
export interface ClientCredentials {
    client_id: string
    client_secret: string
}

/**
 *  This object is sent by the backend upon successful initialisation of a Gmail-based wallet.
 *
 *  @property {CSL.Address} address         - The new wallet's address
 *  @property {string}      transaction     - Transaction to be signed and submitted to initialise the wallet
 *  @property {number}      transaction_fee - The expected fee of the wallet initialisation transaction
 *  @property {string}      transaction_id  - The ID of the wallet initialisation transaction
 */
export interface CreateWalletResponse {
    address: CSL.Address
    transaction: string
    transaction_fee: number
    transaction_id: string
}

/**
 *  This object is sent by the backend upon a successful request to the /send_funds endpoint 
 *
 *  @property {string}      transaction     - Transaction to be signed and submitted 
 *  @property {number}      transaction_fee - The expected fee of the transaction
 *  @property {string}      transaction_id  - The ID of the transaction
 */
export interface SendFundsResponse {
    transaction: string
    transaction_fee: number
    transaction_id: string
}

/**
 *  Transaction ID and email delivery errors, if any 
 *
 * @property {string}      transaction_id         - Transaction ID 
 * @property {Array}       notifier_errors        - Recipients who were not notified
 */
export interface SubmitTxResult {
    transaction_id: string
    notifier_errors: FailedNotification[]
}

/**
 * Email address to which notification couldn't be delivered and the reason.
 * 
 * @property {string} email - Email address
 * @property {string} error - The reason why notification failed
 */
export interface FailedNotification {
    email: string
    error: string
}


/**
 * Details of a token from Cardano Token Registry 
 * 
 * @property {string} asset - The asset name <minting_policy_id>.<asset_name> 
 * @property {string} ticker - The ticker of a token (e.g. SNEK) 
 * @property {string} token_name - The token name (e.g. Snek)
 * @property {number} decimal_adjustment - The numeric value that specifies the number of decimal places that the token can have
 * @property {string} logo - The token logo as a base64 string 
 */
export interface PrettyToken {
    asset: string
    amount: number
    ticker?: string 
    description: string
    token_name: string 
    decimal_adjustment?: number
    logo?: string
}

/**
 * Balance of a wallet 
 * 
 * @property {number} lovelace - The number of lovelace held 
 * @property {Array}  tokens - The array of tokens held
 * @property {number} usd - the approximate value of the assets in USD
 */
export interface BalanceResponse {
    lovelace: number 
    tokens: PrettyToken[]
    usd: number
}
