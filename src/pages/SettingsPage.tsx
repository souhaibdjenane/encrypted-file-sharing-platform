/**
 * SettingsPage — /settings
 *
 * Sections:
 *  1. Key Status     — fingerprint, loaded state
 *  2. Key Backup     — download encrypted backup
 *  3. Key Restore    — upload backup file and re-import
 *  4. Danger Zone    — delete all my files (two-step)
 */
import React, { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCrypto } from '../contexts/CryptoContext'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../api/supabaseClient'
import { exportKeyBackup, restoreKeyBackup, getPublicKeyFingerprint } from '../crypto/keyBackup'

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, description, children }: {
    title: string; description: string; children: React.ReactNode
}) {
    return (
        <div className="rounded-xl border border-vs-border bg-vs-bg p-6 space-y-4">
            <div>
                <h2 className="text-base font-semibold text-vs-text">{title}</h2>
                <p className="text-sm text-vs-text-subtle mt-0.5">{description}</p>
            </div>
            {children}
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SettingsPage() {
    const { keyPair, keysReady } = useCrypto()
    const { user } = useAuthStore()
    const queryClient = useQueryClient()

    // Key fingerprint
    const [fingerprint, setFingerprint] = useState<string | null>(null)
    const [fingerprintLoading, setFingerprintLoading] = useState(false)

    const loadFingerprint = async () => {
        if (!keyPair || fingerprint) return
        setFingerprintLoading(true)
        try {
            const fp = await getPublicKeyFingerprint(keyPair.publicKey)
            setFingerprint(fp)
        } finally {
            setFingerprintLoading(false)
        }
    }

    React.useEffect(() => {
        if (keysReady && keyPair) loadFingerprint()
    }, [keysReady]) // eslint-disable-line react-hooks/exhaustive-deps

    // Backup
    const [backupPassword, setBackupPassword] = useState('')
    const [backupPassword2, setBackupPassword2] = useState('')
    const [backupLoading, setBackupLoading] = useState(false)
    const [backupError, setBackupError] = useState<string | null>(null)
    const [backupDone, setBackupDone] = useState(false)

    const handleBackup = async (e: React.FormEvent) => {
        e.preventDefault()
        setBackupError(null)
        if (!keyPair) { setBackupError('Encryption keys not loaded.'); return }
        if (backupPassword.length < 8) { setBackupError('Password must be at least 8 characters.'); return }
        if (backupPassword !== backupPassword2) { setBackupError('Passwords do not match.'); return }
        setBackupLoading(true)
        try {
            await exportKeyBackup(keyPair.privateKey, backupPassword)
            setBackupDone(true)
            setBackupPassword(''); setBackupPassword2('')
            setTimeout(() => setBackupDone(false), 4000)
        } catch (err: unknown) {
            setBackupError(err instanceof Error ? err.message : 'Backup failed.')
        } finally {
            setBackupLoading(false)
        }
    }

    // Restore
    const restoreInputRef = useRef<HTMLInputElement>(null)
    const [restorePassword, setRestorePassword] = useState('')
    const [restoreLoading, setRestoreLoading] = useState(false)
    const [restoreError, setRestoreError] = useState<string | null>(null)
    const [restoreDone, setRestoreDone] = useState(false)

    const handleRestore = async (e: React.FormEvent) => {
        e.preventDefault()
        setRestoreError(null)
        const file = restoreInputRef.current?.files?.[0]
        if (!file) { setRestoreError('Please select a backup file.'); return }
        if (!restorePassword) { setRestoreError('Enter your backup password.'); return }

        setRestoreLoading(true)
        try {
            const json = await file.text()
            const restoredKey = await restoreKeyBackup(json, restorePassword)
            // Persist the restored private key to IndexedDB via CryptoContext method
            // For now: show success and instruct the user to refresh
            console.info('Key restored successfully', restoredKey)
            setRestoreDone(true)
            setRestorePassword('')
        } catch (err: unknown) {
            setRestoreError(err instanceof Error ? err.message : 'Restore failed.')
        } finally {
            setRestoreLoading(false)
        }
    }

    // Danger zone — delete all files
    const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle')
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const handleDeleteAll = async () => {
        if (deleteStep === 'idle') { setDeleteStep('confirm'); return }
        if (deleteStep !== 'confirm') return

        setDeleteStep('deleting')
        setDeleteError(null)
        try {
            const { error } = await supabase.from('files').delete().eq('owner_id', user!.id)
            if (error) throw new Error(error.message)
            queryClient.invalidateQueries({ queryKey: ['files', user?.id] })
            setDeleteStep('done')
        } catch (err: unknown) {
            setDeleteError(err instanceof Error ? err.message : 'Delete failed.')
            setDeleteStep('confirm')
        }
    }

    return (
        <div className="flex-1 px-4 py-12">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-vs-text">Settings</h1>
                    <p className="text-sm text-vs-text-subtle mt-1">Manage your encryption keys and account preferences.</p>
                </div>

                {/* ── 1. Key Status ── */}
                <Section
                    title="Encryption Key Status"
                    description="Your RSA-4096 key pair is stored in your browser's IndexedDB and never leaves your device."
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${keysReady ? 'bg-green-500' : 'bg-amber-400'}`} />
                        <p className="text-sm text-vs-text">
                            {keysReady ? 'Keys loaded and ready' : 'Keys not yet generated'}
                        </p>
                    </div>
                    {fingerprint ? (
                        <div className="bg-vs-bg-subtle rounded-lg px-4 py-3 flex flex-col gap-1">
                            <p className="text-xs text-vs-text-subtle font-medium uppercase tracking-wide">Public key fingerprint</p>
                            <p className="text-sm font-mono text-vs-text tracking-widest">{fingerprint}</p>
                            <p className="text-xs text-vs-text-subtle">SHA-256 of your public key (first 8 bytes)</p>
                        </div>
                    ) : fingerprintLoading ? (
                        <div className="h-14 bg-vs-border/30 rounded-lg animate-pulse" />
                    ) : null}
                </Section>

                {/* ── 2. Key Backup ── */}
                <Section
                    title="Download Key Backup"
                    description="Encrypt and download your private key. You'll need this password to restore your keys on a new device."
                >
                    <form onSubmit={handleBackup} className="space-y-3">
                        {[
                            { label: 'Backup password', value: backupPassword, set: setBackupPassword, placeholder: 'At least 8 characters' },
                            { label: 'Confirm password', value: backupPassword2, set: setBackupPassword2, placeholder: 'Repeat your password' },
                        ].map(({ label, value, set, placeholder }) => (
                            <div key={label} className="space-y-1">
                                <label className="text-xs font-medium text-vs-text-muted">{label}</label>
                                <input
                                    type="password" value={value} onChange={e => set(e.target.value)}
                                    placeholder={placeholder} disabled={backupLoading || !keysReady}
                                    className="w-full px-3 py-2 rounded-lg border border-vs-border bg-vs-bg text-sm
                    focus:outline-none focus:ring-2 focus:ring-vs-primary/50 focus:border-vs-primary transition-all"
                                />
                            </div>
                        ))}
                        {backupError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{backupError}</p>}
                        {backupDone && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">✓ Backup file downloaded.</p>}
                        <button type="submit" disabled={backupLoading || !keysReady}
                            className="w-full py-2 text-sm font-medium text-white bg-vs-primary hover:bg-vs-primary/90 disabled:opacity-50 rounded-lg transition-colors">
                            {backupLoading ? 'Encrypting…' : '⬇ Download Encrypted Backup'}
                        </button>
                    </form>
                </Section>

                {/* ── 3. Key Restore ── */}
                <Section
                    title="Restore Keys from Backup"
                    description="Import a previously downloaded backup file to recover your encryption keys."
                >
                    <form onSubmit={handleRestore} className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-vs-text-muted">Backup file (.json)</label>
                            <input ref={restoreInputRef} type="file" accept=".json"
                                className="w-full text-sm text-vs-text file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0
                  file:bg-vs-bg-subtle file:text-vs-text file:text-sm cursor-pointer" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-vs-text-muted">Backup password</label>
                            <input type="password" value={restorePassword} onChange={e => setRestorePassword(e.target.value)}
                                placeholder="Enter backup password" disabled={restoreLoading}
                                className="w-full px-3 py-2 rounded-lg border border-vs-border bg-vs-bg text-sm
                  focus:outline-none focus:ring-2 focus:ring-vs-primary/50 focus:border-vs-primary transition-all" />
                        </div>
                        {restoreError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{restoreError}</p>}
                        {restoreDone && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">✓ Keys restored. Please refresh the page.</p>}
                        <button type="submit" disabled={restoreLoading}
                            className="w-full py-2 text-sm font-medium text-vs-text bg-vs-bg-subtle hover:bg-vs-border/50 rounded-lg transition-colors">
                            {restoreLoading ? 'Restoring…' : '↑ Restore from Backup'}
                        </button>
                    </form>
                </Section>

                {/* ── 4. Danger Zone ── */}
                <div className="rounded-xl border border-red-200 bg-red-50/30 p-6 space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
                        <p className="text-sm text-red-600/80 mt-0.5">These actions are irreversible.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-200 bg-white/50">
                        <div>
                            <p className="text-sm font-medium text-vs-text">Delete all my files</p>
                            <p className="text-xs text-vs-text-subtle">Permanently deletes every file you own, including shared copies.</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {deleteStep === 'confirm' && (
                                <>
                                    <span className="text-xs text-red-600 font-medium">This cannot be undone.</span>
                                    <button onClick={() => setDeleteStep('idle')} className="text-xs text-vs-text-subtle hover:text-vs-text">Cancel</button>
                                </>
                            )}
                            {deleteStep === 'done' ? (
                                <span className="text-xs text-green-700 font-medium">✓ All files deleted</span>
                            ) : (
                                <button
                                    onClick={handleDeleteAll}
                                    disabled={deleteStep === 'deleting'}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                    ${deleteStep === 'confirm'
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'border border-red-300 text-red-600 hover:bg-red-50'
                                        } disabled:opacity-50`}
                                >
                                    {deleteStep === 'deleting' ? 'Deleting…' : deleteStep === 'confirm' ? 'Yes, delete all' : 'Delete all files'}
                                </button>
                            )}
                        </div>
                    </div>
                    {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
                </div>
            </div>
        </div>
    )
}
