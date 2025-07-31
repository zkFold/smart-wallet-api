import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      copyDtsFiles: false,
      rollupTypes: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'ZkFoldSmartWalletApi',
      formats: ['es', 'umd', 'iife'],
      fileName: (format) => `smart-wallet-api.${format}.js`
    },
    rollupOptions: {
      external: [
        // Keep these as external for browser compatibility
        '@emurgo/cardano-serialization-lib-browser'
      ],
      output: {
        globals: {
          '@emurgo/cardano-serialization-lib-browser': 'CardanoWasm'
        }
      }
    },
    target: 'es2020',
    minify: 'terser'
  },
  resolve: {
    alias: {
      // Use browser-compatible CSL
      '@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib': '@emurgo/cardano-serialization-lib-browser'
    }
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@scure/bip39', 'axios', 'json-bigint']
  }
})