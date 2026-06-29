import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Honor the PORT env (used by the preview harness) so the dev server binds the
  // expected port; falls back to Vite's default when unset. Proxy /api to the
  // local auth/admin backend during development.
  server: {
    ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
    proxy: {
      // Anchor on `/api/` so the `/api-docs` page route isn't proxied to the backend.
      '^/api/': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
