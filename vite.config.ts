import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

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
  resolve: {
      alias: {
          // This Rollup aliases are extracted from @esbuild-plugins/node-modules-polyfill, 
          // see https://github.com/remorses/esbuild-plugins/blob/master/node-modules-polyfill/src/polyfills.ts
          util: 'rollup-plugin-node-polyfills/polyfills/util',
          sys: 'util',
          events: 'rollup-plugin-node-polyfills/polyfills/events',
          stream: 'rollup-plugin-node-polyfills/polyfills/stream',
          path: 'rollup-plugin-node-polyfills/polyfills/path',
          querystring: 'rollup-plugin-node-polyfills/polyfills/qs',
          punycode: 'rollup-plugin-node-polyfills/polyfills/punycode',
          url: 'rollup-plugin-node-polyfills/polyfills/url',
          string_decoder:
              'rollup-plugin-node-polyfills/polyfills/string-decoder',
          http: 'rollup-plugin-node-polyfills/polyfills/http',
          https: 'rollup-plugin-node-polyfills/polyfills/http',
          os: 'rollup-plugin-node-polyfills/polyfills/os',
          assert: 'rollup-plugin-node-polyfills/polyfills/assert',
          constants: 'rollup-plugin-node-polyfills/polyfills/constants',
          _stream_duplex:
              'rollup-plugin-node-polyfills/polyfills/readable-stream/duplex',
          _stream_passthrough:
              'rollup-plugin-node-polyfills/polyfills/readable-stream/passthrough',
          _stream_readable:
              'rollup-plugin-node-polyfills/polyfills/readable-stream/readable',
          _stream_writable:
              'rollup-plugin-node-polyfills/polyfills/readable-stream/writable',
          _stream_transform:
              'rollup-plugin-node-polyfills/polyfills/readable-stream/transform',
          timers: 'rollup-plugin-node-polyfills/polyfills/timers',
          console: 'rollup-plugin-node-polyfills/polyfills/console',
          vm: 'rollup-plugin-node-polyfills/polyfills/vm',
          zlib: 'rollup-plugin-node-polyfills/polyfills/zlib',
          tty: 'rollup-plugin-node-polyfills/polyfills/tty',
          domain: 'rollup-plugin-node-polyfills/polyfills/domain',
          buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
          process: 'rollup-plugin-node-polyfills/polyfills/process-es6'
      }
  },
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
    include: ['@scure/bip39', 'axios', 'json-bigint'],
    esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
            global: 'globalThis'
        },
        // Enable esbuild polyfill plugins
        plugins: [
            NodeGlobalsPolyfillPlugin({
                process: true,
                buffer: true
            }),
            NodeModulesPolyfillPlugin()
        ]
    }
  }
})
