# WASM Bindings

This folder contains the JavaScript bindings and TypeScript declarations for WebAssembly modules used by the smart wallet API.

## Files

- **`wasi.js`** & **`wasi.d.ts`** - WebAssembly System Interface (WASI) implementation for browser compatibility
- **`ghc_wasm_jsffi.js`** & **`ghc_wasm_jsffi.d.ts`** - GHC WebAssembly JavaScript FFI bindings
- **`blake2b.js`** & **`blake2b.d.ts`** - Blake2b cryptographic hash function implementation

## Purpose

These bindings enable the main WASM module (`proof.wasm`) to interface with browser APIs and provide necessary runtime support for Haskell-compiled WebAssembly code.

## Usage

These files are automatically imported by the main WASM loader (`src/WASM.ts`) and should not be imported directly by other modules.
