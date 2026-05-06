import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three'
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
