import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { supabase } from '@/lib/supabase'
import { LANGUAGES, applyLanguage, type LanguageCode } from '@/lib/i18n'
import { Button } from '@/components/ui/Button'
import Logo from '@/assets/VaultShare-logo.svg'

/* ─── Icons ─────────────────────────────────────────────── */
function SunIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
    )
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
        </svg>
    )
}

/* ─── Avatar ─────────────────────────────────────────────── */
function Avatar({ src, name }: { src: string | null; name: string | null }) {
    const initials = name
        ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
        : '?'

    if (src) {
        return (
            <img
                src={src}
                alt={name ?? 'avatar'}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-vs-primary/40 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
        )
    }

    return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-vs-primary to-vs-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
        </div>
    )
}

/* ─── Header ─────────────────────────────────────────────── */
export function Header() {
    const { user, profile } = useAuthStore()
    const { theme, toggleTheme } = useThemeStore()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const [langOpen, setLangOpen] = useState(false)

    const rawCode = i18n.language?.split('-')[0] as LanguageCode
    const currentLang = LANGUAGES.find((l) => l.code === rawCode) ?? LANGUAGES[0]

    async function handleLogout() {
        await supabase.auth.signOut()
        navigate('/login')
    }

    function handleLanguageChange(code: LanguageCode) {
        i18n.changeLanguage(code)
        applyLanguage(code)
        setLangOpen(false)
    }

    return (
        <header className="sticky top-0 z-50 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

                {/* Logo — goes to /dashboard when authenticated, / when not */}
                <Link
                    to={user ? '/dashboard' : '/'}
                    className="flex items-center gap-2.5 text-xl font-bold text-vs-text tracking-tight hover:opacity-80 transition-opacity shrink-0"
                >
                    <img src={Logo} alt="VaultShare" className="w-9 h-9" />
                    <span className="hidden sm:inline">VaultShare</span>
                </Link>

                {/* Controls */}
                <div className="flex items-center gap-2">

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        aria-label="Toggle theme"
                        className="p-2 rounded-lg text-vs-text-muted hover:bg-vs-bg-subtle hover:text-vs-text transition-all duration-150"
                    >
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </button>

                    {/* Language Switcher */}
                    <div className="relative">
                        <button
                            onClick={() => setLangOpen((v) => !v)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold text-vs-text-muted hover:bg-vs-bg-subtle hover:text-vs-text transition-all duration-150 border border-vs-border tracking-wide"
                        >
                            {/* Short code badge */}
                            <span className="text-xs font-bold">{currentLang.shortCode}</span>
                            <ChevronIcon open={langOpen} />
                        </button>

                        {langOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
                                <div className="absolute end-0 mt-2 w-40 rounded-xl border border-vs-border bg-vs-bg shadow-xl shadow-black/10 z-20 overflow-hidden py-1">
                                    {LANGUAGES.map((lang) => {
                                        const isActive = lang.code === currentLang.code
                                        return (
                                            <button
                                                key={lang.code}
                                                onClick={() => handleLanguageChange(lang.code)}
                                                className={`
                          w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-100
                          ${isActive
                                                        ? 'bg-vs-primary-light text-vs-primary font-semibold'
                                                        : 'text-vs-text hover:bg-vs-bg-subtle'
                                                    }
                        `}
                                            >
                                                <span className="inline-flex items-center justify-center w-6 h-5 rounded text-xs font-bold bg-vs-bg-muted text-vs-text-muted shrink-0">
                                                    {lang.shortCode}
                                                </span>
                                                <span>{lang.label}</span>
                                                {lang.dir === 'rtl' && (
                                                    <span className="ms-auto text-[10px] text-vs-text-subtle">RTL</span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="h-5 border-l border-vs-border hidden sm:block" />
                    {/* Auth area */}
                    {user ? (
                        <div className="flex items-center gap-2.5">
                            {/* Clickable user chip → go to dashboard */}
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-vs-bg-subtle transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-vs-primary focus:ring-offset-1"
                                aria-label="Go to dashboard"
                            >
                                <Avatar src={profile.avatarUrl} name={profile.displayName} />
                                <div className="hidden md:flex flex-col leading-tight min-w-0 text-start">
                                    <span className="text-xs font-semibold text-vs-text truncate max-w-[140px]">
                                        {profile.displayName ?? profile.email?.split('@')[0] ?? '—'}
                                    </span>
                                    <span className="text-[11px] text-vs-text-muted truncate max-w-[140px]">
                                        {profile.email}
                                    </span>
                                </div>
                            </button>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                {t('nav.signOut')}
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Link to="/login">
                                <Button variant="ghost" size="sm">{t('nav.signIn')}</Button>
                            </Link>
                            <Link to="/register">
                                <Button size="sm">{t('nav.getStarted')}</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
