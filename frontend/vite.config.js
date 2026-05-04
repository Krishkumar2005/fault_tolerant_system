import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/events': import.meta.VITE_API_BASE_URL || 'http://localhost:3001',
      '/aggregations': import.meta.VITE_API_BASE_URL ||'http://localhost:3001',
      '/health': import.meta.VITE_API_BASE_URL || 'http://localhost:3001',
    }
  }
})
