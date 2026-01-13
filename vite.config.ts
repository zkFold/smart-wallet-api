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