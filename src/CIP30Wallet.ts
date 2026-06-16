import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { UTxO, TransactionRequest, BalanceResponse, Transaction } from './Types'

export interface CIP30Wallet {

    /**
     * @async
     * Get the Wallet's address
     */
    getAddress(): Promise<CSL.Address>; 

    /**
     * @async
     * Get an unused address for the wallet 
     */
    getUnusedAddress(): Promise<CSL.Address>;

    /**
     * @async
     * Get wallet's balance as an object with asset names as property names and amounts as their values.
     */
    getBalance(): Promise<BalanceResponse>;

    /**
     * @async
     * Get the approximate USD value of all wallet's assets 
     */
    getUSDValue(): Promise<number>;

    /**
     * @async
     * Get wallet's transaction history 
     */
    getTxHistory(): Promise<Transaction[]>;

    /**
     * Get extensions turned on in the wallet
     */
    getExtensions(): string[];

    /**
     * @async
     * Get UTxOs held by the wallet 
     */
    getUtxos(): Promise<UTxO[]>;

    /**
     * @async
     * Get wallet's used addresses (currently only wallet's main address) 
     */
    getUsedAddresses(): Promise<CSL.Address[]>;

    /**
     * @async
     * Get wallet's unused addresses 
     */
    getUnusedAddresses(): Promise<CSL.Address[]>;

    /**
     * @async
     * Get wallet's reward addresses (currently none) 
     */
    getRewardAddresses(): Promise<CSL.Address[]>;

    /**
     * @async
     * Get wallet's change address (currently wallet's main address) 
     */
    getChangeAddress(): Promise<CSL.Address>;

    /**
     * @async
     * Send a transaction from this wallet.
     *
     * @param {TransactionRequest} request - Transaction request object
     */
    sendTransaction(request: TransactionRequest): Promise<void>;
}
