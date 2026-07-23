import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/upload': 'http://localhost:8000',
      '/datasets': 'http://localhost:8000',
      '/eda': 'http://localhost:8000',
      '/clean': 'http://localhost:8000',
      '/train': 'http://localhost:8000',
      '/results': 'http://localhost:8000',
      '/predict': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
