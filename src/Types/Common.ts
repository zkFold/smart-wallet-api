import * as CSL from '@emurgo/cardano-serialization-lib-asmjs'

/**
 * Wrapper for various integer types used in communication with the Backend, Prover, and CSL.
 * Provides a JSON representation unavailable for bignum.
 */
export class BigIntWrap {
    private int!: bigint

    constructor(num: string | number | bigint | CSL.BigNum) {
        if (typeof num == "string") {
            this.int = BigInt(num)
        } else if (typeof num == "number") {
            this.int = BigInt(num)
        } else if (typeof num == "bigint") {
            this.int = BigInt(num)
        } else {
            this.int = BigInt(num.toString())
        }
    }

    add(other: BigIntWrap): BigIntWrap {
        return new BigIntWrap(this.int + other.int)
    }

    increase(other: BigIntWrap): void {
        this.int += other.int
    }

    toString(): string {
        return this.int.toString()
    }

    toNumber(): number {
        return Number(this.int)
    }

    toBigInt(): bigint {
        return this.int
    }

    toBigNum(): CSL.BigNum {
        return CSL.BigNum.from_str(this.int.toString())
    }

    toJSON(): bigint {
        return this.int
    }
}
