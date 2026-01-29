import { BigIntWrap } from "./Types";

/**
 * Convert a hex string to a byte array
 * https://stackoverflow.com/questions/14603205/how-to-convert-hex-string-into-a-bytes-array-and-a-bytes-array-in-the-hex-strin
 */
export function hexToBytes(hex: string): Uint8Array {
    const bytes = []
    for (let c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16))
    return Uint8Array.from(bytes)
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Convert BigInt to byte array
 */
export function bigIntToBytes(bigInt: bigint, numBytes: number | undefined = undefined): Uint8Array {
    const hex = bigInt.toString(16)
    let paddedHex = hex.length % 2 ? '0' + hex : hex
    if (numBytes) {
       const currentBytes = paddedHex.length / 2
       if (numBytes > currentBytes) {
            for (let i = 0; i < (numBytes - currentBytes) / 2; ++i) {
                paddedHex = '00' + paddedHex
            }
       }
    }
    const bytes = new Uint8Array(paddedHex.length / 2)
    for (let i = 0; i < paddedHex.length; i += 2) {
        bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16)
    }
    return bytes
}

/**
 * Convert bytes to base64url string
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function base64UrlDecode(str: string): string {
  const base64Encoded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64WithPadding = base64Encoded + padding;
  return atob(base64WithPadding)
    .split('')
    .map(char => String.fromCharCode(char.charCodeAt(0)))
    .join('');
}

export function harden(num: number): number {
    return 0x80000000 + num
}

// https://coolaj86.com/articles/bigints-and-base64-in-javascript/
export function b64ToBn(b64: string): BigIntWrap {
    const bin = atob(b64)
    const hex: string[] = []

    bin.split('').forEach(function (ch) {
        let h = ch.charCodeAt(0).toString(16)
        if (h.length % 2) { h = '0' + h }
        hex.push(h)
    })

    return new BigIntWrap(BigInt('0x' + hex.join('')))
}


// binary exponentiation with remainder calculation on each step to prevent memory blowup
export function expMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === 1n) return 0n;
    let result = 1n;
    base = base % modulus; 
    while (exponent > 0n) {
        if ((exponent & 1n) === 1n) {
            result = (result * base) % modulus;
        }
        exponent >>= 1n; 
        base = (base * base) % modulus; 
    }
    return result;
}
