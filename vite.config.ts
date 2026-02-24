import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      copyDtsFiles: false,
      rollupTypes: true
    }),
    nodePolyfills({
          // Specify which polyfills to include (optional, but recommended for bundle size)
          include: ['buffer'], // Only polyfill 'buffer' (add others like 'process' if needed)
          
          // Configure global variables (e.g., expose Buffer to window)
          globals: {
            Buffer: true, // Expose Buffer as a global variable (optional but useful for some cases)
          },
        }),
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
        '@emurgo/cardano-serialization-lib-browser'
      ],
      output: {
        globals: {
          '@emurgo/cardano-serialization-lib-browser': 'CardanoWasm'
        }
      }//,
     // plugins: [inject({ Buffer: ['Buffer', 'Buffer'] })],
    },
    target: 'es2020',
    minify: 'terser'
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: ['@scure/bip39', 'axios', 'json-bigint']
  }
})
