/**
 * Browser-compatible buffer utilities
 */
export const BufferUtils = {
    from: (data: string | Uint8Array | ArrayBuffer, encoding?: string): Uint8Array => {
        if (typeof data === 'string') {
            if (encoding === 'hex') {
                const bytes = [];
                for (let i = 0; i < data.length; i += 2) {
                    bytes.push(parseInt(data.substr(i, 2), 16));
                }
                return new Uint8Array(bytes);
            }
            return new TextEncoder().encode(data);
        }
        return new Uint8Array(data);
    }
};

/**
 * Convert a hex string to a byte array
 * https://stackoverflow.com/questions/14603205/how-to-convert-hex-string-into-a-bytes-array-and-a-bytes-array-in-the-hex-strin
 */
export function hexToBytes(hex: string): Uint8Array {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return Uint8Array.from(bytes);
}