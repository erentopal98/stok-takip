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
  ],
})
