import { WASI } from "./wasi.js";
import ghc_wasm_jsffi from "./ghc_wasm_jsffi.js";
import { blake2b } from "./blake2b.js";
import { parseProofBytes } from './Backend';

/**
 * Browser-compatible WASM loader
 * Uses fetch API instead of Node.js fs for browser/extension compatibility
 */
export class BrowserWasmLoader {
    async loadWasm(wasmUrl?: string): Promise<WebAssembly.Instance> {
        let wasmBytes: ArrayBuffer;
        
        if (wasmUrl) {
            // Custom WASM URL provided (useful for extensions)
            const response = await fetch(wasmUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM from ${wasmUrl}: ${response.statusText}`);
            }
            wasmBytes = await response.arrayBuffer();
        } else {
            // Default WASM loading using import.meta.url
            const wasmPath = new URL('./proof.wasm', import.meta.url);
            const response = await fetch(wasmPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch WASM: ${response.statusText}`);
            }
            wasmBytes = await response.arrayBuffer();
        }

        const jsffiExports = {};
        const wasi = new WASI({
            stdout: (out: string) => console.log("[wasm stdout]", out),
            blake2b: blake2b
        });

        const wasm_bin = await WebAssembly.instantiate(
            wasmBytes,
            Object.assign(
                { ghc_wasm_jsffi: ghc_wasm_jsffi(jsffiExports), blake2b: blake2b },
                wasi.getImportObject()
            )
        );
        Object.assign(jsffiExports, wasm_bin.instance.exports);
        
        wasi.initialize(wasm_bin, {
            ghc_wasm_jsffi: ghc_wasm_jsffi(jsffiExports),
            blake2b: blake2b
        });

        (wasm_bin.instance.exports as any).hs_init(0, 0);
        
        return wasm_bin.instance;
    }
}

/**
 * Initialize WASI instance with browser-compatible WASM loading
 * @param wasmUrl Optional custom WASM URL (useful for browser extensions)
 */
export async function initialiseWASI(wasmUrl?: string): Promise<WebAssembly.Instance> {
    const loader = new BrowserWasmLoader();
    return await loader.loadWasm(wasmUrl);
}

export function mkProofBytesMock(instance: WebAssembly.Instance, x: bigint, ps: bigint[], empi: any) {
    const xStr = x.toString() + "\0";
    const psStr = ps.map((x) => x.toString()).join(" ") + "\0";
    const empiStr = [empi.e.toString(), empi.n.toString(), empi.sig.toString(), empi.tokenName.toString()].join(" ") + "\0";

    const xOffset = 0;
    const psOffset = xStr.length + 1;
    const empiOffset = psOffset + psStr.length + 1;

    const exports = instance.exports as any;
    const xBuf = new Uint8Array(exports.memory.buffer, xOffset, xStr.length);
    const psBuf = new Uint8Array(exports.memory.buffer, psOffset, psStr.length);
    const empiBuf = new Uint8Array(exports.memory.buffer, empiOffset, empiStr.length);
    
    xBuf.forEach((v,i,a) => a[i] = xStr.charCodeAt(i));
    psBuf.forEach((v,i,a) => a[i] = psStr.charCodeAt(i));
    empiBuf.forEach((v,i,a) => a[i] = empiStr.charCodeAt(i));

    const address = exports.mkProofBytesMockWasm(xBuf.byteOffset, psBuf.byteOffset, empiBuf.byteOffset);

    const encodedStringLength = (new Uint8Array(exports.memory.buffer, address)).indexOf(0);
    const encodedStringBuffer = new Uint8Array(exports.memory.buffer, address, encodedStringLength);
    const result = (new TextDecoder()).decode(encodedStringBuffer);
    const json = parseProofBytes(result);
    return json;
}
