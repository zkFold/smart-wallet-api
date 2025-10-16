import * as CSL from '@emurgo/cardano-serialization-lib-browser';
import { BigIntWrap } from './Common';

/**
 *  Value object representing assets (lovelace and tokens).
 *  The keys are asset identifiers (policy_id + '.' + asset_name in hex) or 'lovelace' for ADA.
 *  The values are BigIntWrap representing the quantity of each asset.
 */
export interface Value {
    [key: string]: BigIntWrap
}

/**
 * Optional datum (inline or just hash) to be included.
 * 
 * @property {any} datum - Datum data
 * @property {boolean} is_inline - true for inline datum, false for just datum hash
 */
export interface TxDatum {
    datum: any
    is_inline: boolean
}

/**
 * Transaction output as expected by the backend.
 *
 * @property {string} address 
 * @property {TxDatum} datum  - Optional datum (inline or just hash) to be included
 * @property {Value} value 
 *
 * @example
 *
 * { "address": "addr_test1qrsuhwqdhz0zjgnf46unas27h93amfghddnff8lpc2n28rgmjv8f77ka0zshfgssqr5cnl64zdnde5f8q2xt923e7ctqu49mg5",
 *    "datum": {
 *      "datum": "some_datum_data",
 *      "is_inline": true
 *    },
 *    "value": {
 *      "ff80aaaf03a273b8f5c558168dc0e2377eea810badbae6eceefc14ef.474f4c44": 101,
 *      "lovelace": 22
 *    }
 * }
 */
export interface Output {
    address: string
    datum?: TxDatum
    value: Value
}

/**
 * Transaction input reference containing transaction id and output index.
 *
 * @property {string} transaction_id 
 * @property {number} output_index
 *
 * Will be serialised to JSON as `${transaction_id}#${output_index}`. For example,
 * "4293386fef391299c9886dc0ef3e8676cbdbc2c9f2773507f1f838e00043a189#1"
 */
export interface Reference {
    transaction_id: string
    output_index: number
}

/**
 * UTxO object containing transaction where it was created, address and assets.
 *
 * @param {Reference}   ref          - Transaction output reference
 * @param {CLS.Address} address      - UTxO address
 * @param {Value}       value        - UTxO assets
 *
 * @example
 *
 * {
 *      "address": "addr_test1qrsuhwqdhz0zjgnf46unas27h93amfghddnff8lpc2n28rgmjv8f77ka0zshfgssqr5cnl64zdnde5f8q2xt923e7ctqu49mg5",
 *      "ref": {
 *          "transaction_id": "4293386fef391299c9886dc0ef3e8676cbdbc2c9f2773507f1f838e00043a189",
 *          "output_index": 1
 *      }
 *      "value": {
 *          "ff80aaaf03a273b8f5c558168dc0e2377eea810badbae6eceefc14ef.474f4c44": 101,
 *          "lovelace": 22
 *      }
 *  }
 */
export interface UTxO {
    ref: Reference
    address: CSL.Address
    value: Value
}
