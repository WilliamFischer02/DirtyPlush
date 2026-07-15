import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy visualization libraries out of the main chunk so
        // first paint doesn't wait on them.
        manualChunks: {
          leaflet: ['leaflet'],
          vis: ['vis-timeline/standalone'],
          graph: ['react-force-graph-2d'],
        },
      },
    },
  },
})
