import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + routing — loaded on every page
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Supabase — lazy-loaded after auth
          supabase: ['@supabase/supabase-js'],
          // React Query — data fetching layer
          query: ['@tanstack/react-query'],
          // i18n — translation library
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
    // Warn when a chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
  },
})