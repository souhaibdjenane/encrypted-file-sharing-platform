import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
// Initialize i18n before app renders
import './lib/i18n'
// Apply persisted theme before paint (avoids flash)
import { useThemeStore, applyTheme } from './store/themeStore'
applyTheme(useThemeStore.getState().theme)

import App from './App.tsx'

// ── Sentry (no-op when DSN is not set) ──────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const IS_PROD = import.meta.env.PROD

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PROD ? 'production' : 'development',
    tracesSampleRate: IS_PROD ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: IS_PROD ? 0.1 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,     // Never record user text
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      // Scrub any sensitive fields from error payloads
      const scrubKeys = /key|password|token|private|secret|credential/i

      const scrubObject = (obj: Record<string, unknown> | null | undefined): void => {
        if (!obj || typeof obj !== 'object') return
        for (const k of Object.keys(obj)) {
          if (scrubKeys.test(k)) {
            obj[k] = '[SCRUBBED]'
          } else if (typeof obj[k] === 'object') {
            scrubObject(obj[k] as Record<string, unknown>)
          }
        }
      }

      // Strip request body (may contain form data)
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
      }

      // Scrub extra / contexts
      scrubObject(event.extra as Record<string, unknown>)
      if (event.contexts) {
        for (const ctx of Object.values(event.contexts)) {
          scrubObject(ctx as Record<string, unknown>)
        }
      }

      return event
    },
  })
}

// ── React Query ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
