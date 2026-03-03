import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(() => {
  // Use VITE_BASE_PATH if set (e.g. for GitHub Pages), otherwise default to '/' for local/Vercel
  const basePath = process.env.VITE_BASE_PATH || '/'

  return {
    plugins: [react()],
    base: basePath,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    worker: {
      format: 'es' as const,
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
  }
})