import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from './Header'

export function Layout() {
    const { t } = useTranslation()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col transition-colors duration-200">
            <Header />
            <main className="flex-1 flex flex-col">
                <Outlet />
            </main>
            <footer className="border-t border-slate-200 dark:border-zinc-800 py-6 text-center text-xs text-slate-400 dark:text-zinc-600">
                {t('footer')}
            </footer>
        </div>
    )
}
