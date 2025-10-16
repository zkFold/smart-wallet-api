/**
 * JSON serialization utilities to handle big integers
 */

import JSONbig from 'json-bigint'

// Configure JSONbig to handle BigInt values properly
const JSONbigConfig = JSONbig({
    storeAsString: false,
    useNativeBigInt: true
})

export function serialize(data: any): string {
    return JSONbigConfig.stringify(data)
}

export function deserialize(jsonString: string): any {
    try {
        return JSONbigConfig.parse(jsonString)
    } catch (error) {
        console.error('Failed to parse JSON:', error)
        return null
    }
}
