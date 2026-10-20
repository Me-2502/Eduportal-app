import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // In dev the API is proxied, so the browser talks to one origin and CORS never comes up.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
