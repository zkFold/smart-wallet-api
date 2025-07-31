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