import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Initialize i18n before app renders
import './lib/i18n'
// Apply persisted theme before paint (avoids flash)
import { useThemeStore, applyTheme } from './store/themeStore'
applyTheme(useThemeStore.getState().theme)

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
