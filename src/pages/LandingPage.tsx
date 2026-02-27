import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import Lock from '../assets/Lock.svg';
import LinkIcon from '../assets/Link.svg';
import AutoDelete from '../assets/Auto-delete.svg';




export function LandingPage() {
    const { user, isLoading } = useAuthStore()
    const { t } = useTranslation()

    // If already authenticated, go straight to dashboard
    if (!isLoading && user) return <Navigate to="/dashboard" replace />

    const features = [
        { icon: Lock, title: t('landing.feat1Title'), description: t('landing.feat1Desc') },
        { icon: LinkIcon, title: t('landing.feat2Title'), description: t('landing.feat2Desc') },
        { icon: AutoDelete, title: t('landing.feat3Title'), description: t('landing.feat3Desc') },
    ]

    return (
        <div className="flex-1 flex flex-col">
            {/* Hero */}
            <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-vs-primary/10 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-vs-border bg-vs-primary-light text-vs-primary text-xs font-medium mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-vs-primary animate-pulse" />
                        {t('landing.badge')}
                    </div>

                    <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-vs-text leading-tight">
                        {t('landing.headline')}{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-vs-primary to-vs-secondary">
                            {t('landing.headlineAccent')}
                        </span>
                    </h1>

                    <p className="text-lg text-vs-text-muted max-w-xl mx-auto leading-relaxed">
                        {t('landing.subtext')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                        <Link to="/register">
                            <Button size="lg" className="w-full sm:w-auto">
                                {t('landing.ctaRegister')}
                            </Button>
                        </Link>
                        <Link to="/login">
                            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                                {t('landing.ctaLogin')}
                            </Button>
                        </Link>
                    </div>

                    <p className="text-xs text-vs-text-subtle pt-2">
                        {t('landing.ctaNote')}
                    </p>
                </div>
            </section>

            {/* Features */}
            <section className="border-t border-vs-border bg-vs-bg-subtle px-4 py-20">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-center text-xl font-semibold text-vs-text-muted mb-12">
                        {t('landing.whyTitle')}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <div
                                key={f.title}
                                className="rounded-xl border border-vs-border bg-vs-bg p-6 space-y-3 hover:border-vs-primary transition-colors duration-200"
                            >
                                <div className="w-20 h-20 flex items-center justify-center rounded-xl bg-vs-primary/10 mb-6 group-hover:bg-vs-primary/15 transition-colors">
                                    <img src={f.icon} alt="" className="w-15 h-15" />
                                </div>
                                <h3 className="font-semibold text-vs-text">{f.title}</h3>
                                <p className="text-sm text-vs-text-muted leading-relaxed">{f.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
