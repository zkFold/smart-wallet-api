import { WASI } from "./wasi.js";
import ghc_wasm_jsffi from "./ghc_wasm_jsffi.js";
import { blake2b } from "./blake2b.js";
import fs from "fs";
import path from 'path'
import { fileURLToPath } from 'url';
import { parseProofBytes } from './Backend'

export async function initialiseWASI() {
    const wasi = new WASI({
        stdout: (out) => console.log("[wasm stdout]", out),
        blake2b: blake2b
    });
    
    const jsffiExports = {};
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const wasmPath = path.join(__dirname, 'proof.wasm');
    const src = fs.readFileSync(wasmPath);
    const wasm_bin = await WebAssembly.instantiate(
        src,
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
    
    return wasi.instance; 
}

export function mkProofBytesMock(instance, x, ps, empi) {
    const xStr = x.toString() + "\0";
    const psStr = ps.map((x) => x.toString()).join(" ") + "\0";
    const empiStr = [empi.e.toString(), empi.n.toString(), empi.sig.toString(), empi.tokenName.toString()].join(" ") + "\0";

    const xOffset = 0;
    const psOffset = xStr.length;
    const empiOffset = psOffset + psStr.length;

    const xBuf = new Uint8Array(instance.exports.memory.buffer, xOffset, xStr.length);
    const psBuf = new Uint8Array(instance.exports.memory.buffer, psOffset, psStr.length);
    const empiBuf = new Uint8Array(instance.exports.memory.buffer, empiOffset, empiStr.length);
    
    const utf8Encode = new TextEncoder();

    const xBytes = utf8Encode.encode(xStr);
    const psBytes = utf8Encode.encode(psStr);
    const empiBytes = utf8Encode.encode(empiStr);

    xBuf.forEach((v,i,a) => a[i] = xBytes[i]);
    psBuf.forEach((v,i,a) => a[i] = psBytes[i]);
    empiBuf.forEach((v,i,a) => a[i] = empiBytes[i]);

    const address = instance.exports.mkProofBytesMockWasm(xBuf.byteOffset, psBuf.byteOffset, empiBuf.byteOffset);

    const encodedStringLength = (new Uint8Array(instance.exports.memory.buffer, address)).indexOf(0);
    const encodedStringBuffer = new Uint8Array(instance.exports.memory.buffer, address, encodedStringLength);
    const result = (new TextDecoder()).decode(encodedStringBuffer);
    console.log(result);
    const json = parseProofBytes(result) 
    return json;
}
