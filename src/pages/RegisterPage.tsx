import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { uploadAvatar } from '@/lib/avatarUpload'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GoogleButton } from '@/components/auth/GoogleButton'
import Logo from '@/assets/VaultShare-logo.svg'
import EditIcon from '@/assets/Edit.svg'

/* ─── Avatar Picker ──────────────────────────────────────── */
function AvatarPicker({
    preview,
    onFileChange,
    hint,
    changeLabel,
}: {
    preview: string | null
    onFileChange: (file: File, previewUrl: string) => void
    hint: string
    changeLabel: string
}) {
    const inputRef = useRef<HTMLInputElement>(null)

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const url = URL.createObjectURL(file)
        onFileChange(file, url)
    }

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-vs-border hover:border-vs-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-vs-primary focus:ring-offset-2"
            >
                {preview ? (
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-vs-bg-muted text-vs-text-subtle">
                        <img src={EditIcon} alt="" className="w-7 h-7 opacity-40 group-hover:opacity-70 transition-opacity" />
                    </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <span className="text-white text-xs font-medium text-center px-1">
                        {preview ? changeLabel : '+'}
                    </span>
                </div>
            </button>
            <p className="text-[11px] text-vs-text-subtle text-center">{hint}</p>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleChange}
            />
        </div>
    )
}

/* ─── Register Page ──────────────────────────────────────── */
export function RegisterPage() {
    const { t } = useTranslation()
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    function handleAvatarChange(file: File, previewUrl: string) {
        setAvatarFile(file)
        setAvatarPreview(previewUrl)
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault()
        setError('')

        if (password !== confirm) {
            setError(t('register.passwordMismatch'))
            return
        }
        if (password.length < 8) {
            setError(t('register.passwordShort'))
            return
        }

        setIsLoading(true)

        // Sign up — include display_name immediately in user_metadata
        const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: username.trim() || undefined },
            },
        })

        if (authError) {
            setIsLoading(false)
            setError(authError.message)
            return
        }

        // If we have a session (email confirmation disabled), upload avatar now
        if (data.session && data.user && avatarFile) {
            const avatarUrl = await uploadAvatar(data.user.id, avatarFile)
            if (avatarUrl) {
                await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } })
            }
        }

        setIsLoading(false)
        setSuccess(true)
    }

    if (success) {
        return (
            <div className="flex-1 flex items-center justify-center px-4 py-16">
                <div className="w-full max-w-md text-center space-y-6">
                    {avatarPreview && (
                        <div className="relative inline-block">
                            <img
                                src={avatarPreview}
                                alt="avatar"
                                className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-vs-primary/30"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-vs-success text-white p-1 rounded-full border-2 border-vs-bg">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    )}
                    {!avatarPreview && <div className="text-5xl">✉️</div>}
                    <h2 className="text-2xl font-bold text-vs-text">{t('register.successTitle')}</h2>
                    <p className="text-vs-text-muted leading-relaxed">
                        {t('register.successText', { email })}
                    </p>
                    <Link to="/login">
                        <Button variant="primary" size="lg" className="w-full sm:w-auto">
                            {t('register.backToLogin')}
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex min-h-[calc(100vh-64px)] overflow-hidden">
            {/* Left Column: Visual/Branding (Desktop only) */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-vs-bg-subtle items-start justify-center p-8 lg:p-12 lg:pt-26 overflow-hidden border-r border-vs-border">
                {/* Decorative background elements */}
                <div className="absolute inset-0 bg-gradient-to-tr from-vs-secondary/10 via-transparent to-vs-primary/10" />
                <div className="absolute top-1/4 -left-20 w-80 h-80 bg-vs-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-vs-secondary/5 rounded-full blur-3xl" />

                <div className="relative text-center space-y-6 max-w-sm">
                    <div className="flex justify-center">
                        <div className="p-4 rounded-3xl bg-vs-bg border border-vs-border">
                            <img src={Logo} alt="" className="w-20 h-20" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-vs-text mb-3">Join VaultShare</h2>
                        <p className="text-lg text-vs-text-muted leading-relaxed">
                            {t('register.subtitle')}
                        </p>
                    </div>

                    {/* Features list in branding area */}
                    <div className="pt-8 space-y-4 text-start">
                        {[
                            { title: t('register.privacyFirst'), text: t('register.privacyFirstText') },
                            { title: t('register.zeroKnowledge'), text: t('register.zeroKnowledgeText') }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-4 p-4 rounded-xl border border-vs-border bg-vs-bg/50 backdrop-blur-sm">
                                <div className="w-10 h-10 rounded-lg bg-vs-primary/10 flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-vs-primary" />
                                </div>
                                <div>
                                    <div className="text-vs-text font-semibold text-sm">{item.title}</div>
                                    <div className="text-vs-text-subtle text-xs">{item.text}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Column: Form */}
            <div className="w-full lg:w-1/2 flex items-start justify-center p-6 sm:p-12 lg:p-16 lg:pt-4 bg-vs-bg overflow-y-auto">
                <div className="w-full max-w-md space-y-8 py-6 lg:py-0">
                    {/* Header (Mobile only) */}
                    <div className="lg:hidden text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <img src={Logo} alt="" className="w-14 h-14" />
                        </div>
                        <h1 className="text-2xl font-bold text-vs-text">{t('register.title')}</h1>
                        <p className="text-sm text-vs-text-muted">{t('register.subtitle')}</p>
                    </div>

                    {/* Desktop Title (Hidden on mobile) */}
                    <div className="hidden lg:block">
                        <h1 className="text-3xl font-bold text-vs-text mb-2">{t('register.title')}</h1>
                        <p className="text-vs-text-muted">{t('register.hasAccount')} <Link to="/login" className="text-vs-primary hover:underline">{t('register.signIn')}</Link></p>
                    </div>

                    <div className="space-y-6">
                        {/* Google Sign-Up */}
                        <GoogleButton mode="signup" />

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-vs-border" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-vs-bg px-3 text-vs-text-subtle uppercase tracking-widest">
                                    {t('auth.orContinueWith')}
                                </span>
                            </div>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Avatar & Username Row */}
                            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end">
                                <AvatarPicker
                                    preview={avatarPreview}
                                    onFileChange={handleAvatarChange}
                                    hint={t('register.avatarHint')}
                                    changeLabel={t('register.avatarChange')}
                                />
                                <div className="flex-1 w-full">
                                    <Input
                                        id="username"
                                        label={t('register.username')}
                                        type="text"
                                        placeholder={t('register.usernamePlaceholder')}
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <Input
                                id="email"
                                label={t('register.email')}
                                type="email"
                                placeholder={t('register.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    id="password"
                                    label={t('register.password')}
                                    type="password"
                                    placeholder={t('register.passwordPlaceholder')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                                <Input
                                    id="confirm"
                                    label={t('register.confirm')}
                                    type="password"
                                    placeholder={t('register.confirmPlaceholder')}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    error={confirm && confirm !== password ? t('register.passwordMismatch') : undefined}
                                />
                            </div>

                            {error && (
                                <div className="rounded-lg bg-vs-danger-bg border border-vs-danger-border px-4 py-3 text-sm text-vs-danger animate-in fade-in slide-in-from-top-2">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                                {t('register.submit')}
                            </Button>
                        </form>

                        <p className="text-center text-[10px] text-vs-text-subtle leading-relaxed mt-6">
                            {t('register.terms')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
