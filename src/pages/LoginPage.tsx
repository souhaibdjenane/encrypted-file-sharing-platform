import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GoogleButton } from '@/components/auth/GoogleButton'
import Logo from '@/assets/VaultShare-logo.svg'

export function LoginPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(e: FormEvent) {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        setIsLoading(false)

        if (authError) {
            setError(authError.message)
        } else {
            navigate('/dashboard')
        }
    }

    return (
        <div className="flex-1 flex min-h-[calc(100vh-64px)] overflow-hidden">
            {/* Left Column: Visual/Branding (Desktop only) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-vs-bg-subtle items-start justify-center p-8 lg:p-12 lg:pt-26 overflow-hidden border-r border-vs-border">
                <div className="relative text-center space-y-6 max-w-sm">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-3xl bg-vs-bg border border-vs-border">
                            <img src={Logo} alt="" className="w-20 h-20" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-vs-text mb-3">VaultShare</h2>
                        <p className="text-lg text-vs-text-muted leading-relaxed">
                            {t('login.subtitle')}
                        </p>
                    </div>

                    <div className="pt-8 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-vs-border bg-vs-bg/50 backdrop-blur-sm">
                            <div className="text-vs-primary font-bold text-lg mb-1">AES-256</div>
                            <div className="text-[10px] text-vs-text-subtle uppercase tracking-wider">{t('login.encryption')}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-vs-border bg-vs-bg/50 backdrop-blur-sm">
                            <div className="text-vs-secondary font-bold text-lg mb-1">{t('login.zeroTrust')}</div>
                            <div className="text-[10px] text-vs-text-subtle uppercase tracking-wider">{t('login.architecture')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="w-full lg:w-1/2 flex items-start justify-center p-6 sm:p-12 lg:p-16 lg:pt-4 bg-vs-bg overflow-y-auto">
                <div className="w-full max-w-md space-y-8 py-6 lg:py-0">
                    {/* Header (Mobile only) */}
                    <div className="lg:hidden text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <img src={Logo} alt="" className="w-16 h-16" />
                        </div>
                        <h1 className="text-2xl font-bold text-vs-text">{t('login.title')}</h1>
                        <p className="text-sm text-vs-text-muted">{t('login.subtitle')}</p>
                    </div>

                    {/* Desktop Title (Hidden on mobile) */}
                    <div className="hidden lg:block">
                        <h1 className="text-3xl font-bold text-vs-text mb-2">{t('login.title')}</h1>
                        <p className="text-vs-text-muted">{t('auth.orContinueWith')}</p>
                    </div>

                    {/* Card Content (Always visible) */}
                    <div className="space-y-6">
                        {/* Google Sign-In */}
                        <GoogleButton mode="signin" />

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-vs-border" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-vs-bg px-3 text-vs-text-subtle">
                                    {t('auth.orContinueWith')}
                                </span>
                            </div>
                        </div>

                        {/* Email form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                id="email"
                                label={t('login.email')}
                                type="email"
                                placeholder={t('login.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                            <Input
                                id="password"
                                label={t('login.password')}
                                type="password"
                                placeholder={t('login.passwordPlaceholder')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />

                            {error && (
                                <div className="rounded-lg bg-vs-danger-bg border border-vs-danger-border px-4 py-3 text-sm text-vs-danger">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                                {t('login.submit')}
                            </Button>
                        </form>

                        {/* Register link */}
                        <div className="pt-4 text-center">
                            <p className="text-sm text-vs-text-muted mb-4">
                                {t('login.noAccount')}
                            </p>
                            <Link to="/register">
                                <Button variant="secondary" className="w-full" size="md">
                                    {t('login.createAccount')}
                                </Button>
                            </Link>
                        </div>

                        <p className="text-center text-[10px] text-vs-text-subtle leading-relaxed mt-8">
                            {t('login.securityNote')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
