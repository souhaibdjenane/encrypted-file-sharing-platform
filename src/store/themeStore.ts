import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface ThemeState {
    theme: Theme
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'dark',
            toggleTheme: () => {
                const next = get().theme === 'dark' ? 'light' : 'dark'
                set({ theme: next })
                applyTheme(next)
            },
            setTheme: (theme: Theme) => {
                set({ theme })
                applyTheme(theme)
            },
        }),
        {
            name: 'vaultshare-theme',
            onRehydrateStorage: () => (state) => {
                if (state) applyTheme(state.theme)
            },
        }
    )
)

export function applyTheme(theme: Theme) {
    const root = document.documentElement
    if (theme === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }
}
