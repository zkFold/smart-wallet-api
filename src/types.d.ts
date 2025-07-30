declare module './wasi.js' {
    export class WASI {
        constructor(options: any);
        getImportObject(): any;
        initialize(wasm: any, imports: any): void;
        instance: any;
    }
}

declare module './ghc_wasm_jsffi.js' {
    export default function ghc_wasm_jsffi(exports: any): any;
}

declare module './blake2b.js' {
    export const blake2b: any;
}