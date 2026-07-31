import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy: forwards /api/v1 to the Django backend so no CORS setup is
// needed while developing. Override target with VITE_PROXY_TARGET.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
