import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      util: 'util',
      stream: 'stream-browserify',
    },
  },
  define: {
    'process.env': {},
    'process.version': '"v14.8.0"',
    global: 'globalThis',
  },
})
