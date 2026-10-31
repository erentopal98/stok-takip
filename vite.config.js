import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Electron production loads index.html from file://, so assets must be relative.
  base: './',
  // Keep Electron's first renderer load from waiting on Vite's full HTML crawl.
  optimizeDeps: {
    noDiscovery: true,
    include: ['react', 'react-dom/client', 'lucide-react'],
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'electron-production-content-security-policy',
      apply: 'build',
      transformIndexHtml() {
        return {
          tags: [{
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
            },
            injectTo: 'head'
          }]
        }
      }
    }
  ],
})
