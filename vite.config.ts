import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { seoPages } from './vite-plugins/seo-pages.ts'

export default defineConfig({
  plugins: [react(), seoPages()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
