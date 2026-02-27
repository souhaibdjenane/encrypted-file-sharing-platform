import { useState, useRef, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { uploadAvatar, updateProfile } from '@/lib/avatarUpload'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import EditIcon from '../assets/Edit.svg'
import LockIcon from '../assets/Lock.svg'
import LinkIcon from '../assets/Link.svg'
import ShieldIcon from '../assets/Lock.svg' // Reuse Lock for encrypted files
import Storage from '../assets/Storage.svg'
import Logo from '../assets/VaultShare-logo.svg'

/* ─── Avatar Uploader ──────────────────────────────────── */
function AvatarUploader({
    current,
    displayedName,
    onUploaded,
}: {
    current: string | null
    displayedName: string
    onUploaded: (url: string) => void
}) {
    const { t } = useTranslation()
    const { user } = useAuthStore()
    const inputRef = useRef<HTMLInputElement>(null)
    const [preview, setPreview] = useState<string | null>(current)
    const [uploading, setUploading] = useState(false)

    async function handleChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !user) return

        // Show preview immediately for instant feedback
        setPreview(URL.createObjectURL(file))
        setUploading(true)

        const url = await uploadAvatar(user.id, file)
        setUploading(false)
        if (url) onUploaded(url)
        // No else needed — uploadAvatar always falls back to a data URL
    }

    const initials = displayedName[0]?.toUpperCase() ?? '?'

    return (
        <div className="flex flex-col items-center gap-3">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-vs-border hover:border-vs-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-vs-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {preview ? (
                    <img src={preview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-vs-primary to-vs-secondary text-white text-xl font-bold">
                        {initials}
                    </div>
                )}
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white text-[11px] font-medium text-center px-1">
                    {uploading ? t('dashboard.uploading') : t('dashboard.changeAvatar')}
                </div>
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </div>
    )
}

/* ─── Password Changer ─────────────────────────────────── */
function PasswordChanger({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation()
    const [newPw, setNewPw] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')

    async function handleSave() {
        setError('')
        if (newPw.length < 8) { setError(t('dashboard.passwordTooShort')); return }
        if (newPw !== confirmPw) { setError(t('dashboard.passwordNoMatch')); return }

        setSaving(true)
        const { error: err } = await supabase.auth.updateUser({ password: newPw })
        setSaving(false)

        if (err) { setError(err.message); return }

        setDone(true)
        setTimeout(onClose, 1800)
    }

    if (done) {
        return (
            <p className="text-sm text-vs-success font-medium text-center py-2">
                ✅ {t('dashboard.passwordChanged')}
            </p>
        )
    }

    return (
        <div className="space-y-3">
            <Input
                id="newPw"
                label={t('dashboard.newPassword')}
                type="password"
                placeholder={t('dashboard.newPasswordPlaceholder')}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoFocus
            />
            <Input
                id="confirmPw"
                label={t('dashboard.confirmNewPassword')}
                type="password"
                placeholder={t('dashboard.confirmNewPasswordPlaceholder')}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                error={confirmPw && confirmPw !== newPw ? t('dashboard.passwordNoMatch') : undefined}
            />
            {error && (
                <p className="text-xs text-vs-danger">{error}</p>
            )}
            <div className="flex gap-2">
                <Button size="sm" isLoading={saving} onClick={handleSave} className="flex-1">
                    {t('dashboard.changePassword')}
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    {t('dashboard.cancelEdit')}
                </Button>
            </div>
        </div>
    )
}

/* ─── Dashboard ─────────────────────────────────────────── */
export function DashboardPage() {
    const { user, profile, setProfile } = useAuthStore()
    const { t } = useTranslation()

    // Profile editor state (lives in the welcome banner)
    const [editOpen, setEditOpen] = useState(false)
    const [draftName, setDraftName] = useState('')
    const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [showPwChanger, setShowPwChanger] = useState(false)

    const displayedName = profile.displayName ?? profile.email?.split('@')[0] ?? '—'

    function openEditor() {
        setDraftName(profile.displayName ?? '')
        setPendingAvatarUrl(null)
        setShowPwChanger(false)
        setEditOpen(true)
    }

    async function handleSaveProfile() {
        setSaving(true)
        const { error } = await updateProfile({
            displayName: draftName.trim() || undefined,
            avatarUrl: pendingAvatarUrl ?? undefined,
        })
        setSaving(false)

        if (!error) {
            setProfile({
                displayName: draftName.trim() || profile.displayName,
                avatarUrl: pendingAvatarUrl ?? profile.avatarUrl,
            })
            setEditOpen(false)
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        }
    }

    const vaultStats = [
        { label: t('dashboard.filesEncrypted'), icon: ShieldIcon, value: '0' },
        { label: t('dashboard.storageUsed'), icon: Storage, value: '0 MB' },
        { label: t('dashboard.activeLinks'), icon: LinkIcon, value: '0' },
    ]

    return (
        <div className="flex-1 px-4 py-12">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* ── Welcome / Profile Banner ─────────────────────── */}
                <div className="rounded-xl border border-vs-border bg-vs-bg relative overflow-hidden group hover:border-vs-primary/50 transition-colors">
                    {/* Top row — always visible */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            {profile.avatarUrl ? (
                                <img
                                    src={profile.avatarUrl}
                                    alt={displayedName}
                                    className="w-14 h-14 rounded-full object-cover ring-4 ring-vs-primary/30 shrink-0"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-vs-primary to-vs-secondary flex items-center justify-center text-white text-xl font-bold shrink-0">
                                    {displayedName[0]?.toUpperCase() ?? '?'}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                <p className="text-sm text-vs-primary font-medium">{t('dashboard.ready')}</p>
                                <h1 className="text-xl font-bold text-vs-text">
                                    {t('dashboard.welcome')}{' '}
                                    <span className="text-vs-primary">{displayedName}</span>
                                </h1>
                                <p className="text-xs text-vs-text-subtle">{profile.email}</p>
                            </div>
                        </div>

                        {/* Edit Profile button — no Sign Out here (it's in the header) */}
                        {!editOpen && (
                            <Button variant="secondary" size="md" onClick={openEditor} className="shrink-0 flex items-center gap-2">
                                <img src={EditIcon} alt="" className="w-5 h-5 opacity-70" />
                                {t('dashboard.editProfile')}
                            </Button>
                        )}
                    </div>

                    {/* Inline profile editor — slides in below the welcome row */}
                    {editOpen && (
                        <div className="border-t border-vs-border p-5 space-y-5 bg-vs-bg-subtle backdrop-blur-sm">
                            {/* Avatar upload + name, side by side on larger screens */}
                            <div className="flex flex-col sm:flex-row gap-2 items-start">
                                <AvatarUploader
                                    current={profile.avatarUrl}
                                    displayedName={displayedName}
                                    onUploaded={(url) => setPendingAvatarUrl(url)}
                                />
                                <div className="flex-1 space-y-2 w-full">
                                    <Input
                                        id="editName"
                                        label={t('dashboard.displayName')}
                                        placeholder={t('dashboard.namePlaceholder')}
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        autoFocus
                                    />

                                    {/* Save / Cancel / Change password row */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" isLoading={saving} onClick={handleSaveProfile}>
                                            {t('dashboard.saveProfile')}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setEditOpen(false)}>
                                            {t('dashboard.cancelEdit')}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setShowPwChanger((v) => !v)}
                                            className="flex items-center gap-2"
                                        >
                                            <img src={LockIcon} alt="" className="w-5 h-5 opacity-70" />
                                            {t('dashboard.changePassword')}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Password changer — expandable */}
                            {showPwChanger && (
                                <div className="border-t border-vs-border pt-4">
                                    <PasswordChanger onClose={() => setShowPwChanger(false)} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Success toast */}
                    {saved && (
                        <p className="text-xs text-vs-success font-medium px-5 pb-3">
                            {t('dashboard.profileSaved')}
                        </p>
                    )}
                </div>

                {/* ── Stats ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {vaultStats.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-xl border border-vs-border bg-vs-bg p-6 space-y-4 relative overflow-hidden group hover:border-vs-primary/50 transition-colors"
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-xs text-vs-text-subtle uppercase tracking-widest">{stat.label}</p>
                                    <p className="text-3xl font-bold text-vs-text">{stat.value}</p>
                                </div>
                                <div className="w-20 h-20 rounded-lg bg-vs-primary/5 flex items-center justify-center group-hover:bg-vs-primary/10 transition-colors">
                                    <img src={stat.icon} alt="" className="w-12 h-12 opacity-60 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Upload Drop Zone ──────────────────────────────── */}
                <div className="rounded-2xl border border-dashed border-vs-border bg-vs-bg-subtle p-8 text-center space-y-4 hover:border-vs-primary transition-colors duration-300 cursor-pointer group">
                    <div className="flex justify-center group-hover:scale-110 transition-transform duration-200">
                        <img src={Logo} alt="" className="w-24 h-24 opacity-80" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-vs-text font-semibold">{t('dashboard.dropTitle')}</p>
                        <p className="text-sm text-vs-text-muted">{t('dashboard.dropSubtext')}</p>
                    </div>
                    <Button variant="secondary" size="md">{t('dashboard.browse')}</Button>
                </div>

                {/* ── Recent Files ──────────────────────────────────── */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-vs-text-muted uppercase tracking-widest">
                        {t('dashboard.recentFiles')}
                    </h2>
                    <div className="rounded-xl border border-vs-border bg-vs-bg p-8 text-center text-vs-text-subtle text-sm">
                        {t('dashboard.noFiles')}
                    </div>
                </div>
            </div>
        </div>
    )
}
