/**
 * ShareModal — unified tabbed modal for sharing a file.
 *
 * Tab A "Share": email input, permissions, expiry, submit
 * Tab B "Access": existing shares list with revoke + copy-link buttons
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCrypto } from '../../contexts/CryptoContext'
import { useAuthStore } from '../../store/authStore'
import { filesApi } from '../../api/filesApi'
import { unwrapFileKey, wrapFileKey } from '../../crypto/keyWrap'
import { importPublicKey } from '../../crypto/keys'
import { supabase } from '../../api/supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────
interface ShareRecord {
    id: string
    shared_with: string | null
    created_at: string
    expires_at: string | null
    revoked: boolean
    can_download: boolean
    can_reshare: boolean
    token: string
}

export interface ShareModalProps {
    isOpen: boolean
    onClose: () => void
    fileId: string
    fileName: string
    wrappedKeyBase64: string
}

type Tab = 'share' | 'access'

// ── Helpers ────────────────────────────────────────────────────────────────────
function ShareBadge({ label, active }: { label: string; active: boolean }) {
    return (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
      ${active ? 'bg-green-100 text-green-700' : 'bg-vs-border/70 text-vs-text-subtle'}`}>
            {label}
        </span>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ShareModal({ isOpen, onClose, fileId, fileName, wrappedKeyBase64 }: ShareModalProps) {
    const { keyPair } = useCrypto()
    const { user } = useAuthStore()
    const queryClient = useQueryClient()

    const [tab, setTab] = useState<Tab>('share')

    // ── Share-tab state ──────────────────────────────────────────────────────
    const [email, setEmail] = useState('')
    const [canDownload, setCanDownload] = useState(true)
    const [canReshare, setCanReshare] = useState(false)
    const [expiryDate, setExpiryDate] = useState('')
    const [shareLoading, setShareLoading] = useState(false)
    const [shareError, setShareError] = useState<string | null>(null)
    const [shareSuccess, setShareSuccess] = useState<string | null>(null)

    // ── Access-tab state ─────────────────────────────────────────────────────
    const [shares, setShares] = useState<ShareRecord[]>([])
    const [sharesLoading, setSharesLoading] = useState(false)
    const [sharesError, setSharesError] = useState<string | null>(null)
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)

    // Load shares when access tab is opened
    const loadShares = useCallback(async () => {
        setSharesLoading(true)
        setSharesError(null)
        try {
            const { data, error } = await supabase
                .from('shares')
                .select('id, shared_with, created_at, expires_at, revoked, can_download, can_reshare, token')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false })

            if (error) throw new Error(error.message)
            setShares(data ?? [])
        } catch (err: unknown) {
            setSharesError(err instanceof Error ? err.message : 'Failed to load access list')
        } finally {
            setSharesLoading(false)
        }
    }, [fileId])

    useEffect(() => {
        if (isOpen && tab === 'access') loadShares()
    }, [isOpen, tab, loadShares])

    // Reset share-tab on open
    useEffect(() => {
        if (isOpen) {
            setEmail(''); setShareError(null); setShareSuccess(null); setTab('share')
        }
    }, [isOpen])

    if (!isOpen) return null

    // ── Share submission ──────────────────────────────────────────────────────
    const handleShare = async (e: React.FormEvent) => {
        e.preventDefault()
        setShareError(null)
        setShareSuccess(null)

        if (!keyPair) { setShareError('Encryption keys not ready.'); return }
        if (!email.trim() || !email.includes('@')) { setShareError('Enter a valid email address.'); return }

        setShareLoading(true)
        try {
            const expiresAt = expiryDate ? new Date(expiryDate).toISOString() : null

            const shareRes = await filesApi.shareFile({
                fileId,
                recipientEmail: email.trim(),
                canDownload,
                canReshare,
                expiresAt,
            })

            const fileKey = await unwrapFileKey(wrappedKeyBase64, keyPair.privateKey)
            const recipientPubKey = await importPublicKey(shareRes.recipientPublicKey)
            const recipientWrappedKey = await wrapFileKey(fileKey, recipientPubKey)

            const { error: keyError } = await supabase.from('file_keys').insert({
                file_id: fileId,
                user_id: shareRes.recipientId,
                wrapped_key: recipientWrappedKey,
            })

            if (keyError && keyError.code !== '23505') {
                throw new Error(`Failed to grant decryption access: ${keyError.message}`)
            }

            setShareSuccess(`Shared with ${email.trim()} ✓`)
            setEmail('')
            setExpiryDate('')
            // Switch to access tab so user sees the new entry
            setTimeout(() => { setShareSuccess(null); setTab('access') }, 1200)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to share file'
            setShareError(msg)
        } finally {
            setShareLoading(false)
        }
    }

    // ── Revoke share (optimistic) ─────────────────────────────────────────────
    const handleRevoke = async (shareId: string) => {
        // Optimistic update
        setShares(prev => prev.map(s => s.id === shareId ? { ...s, revoked: true } : s))
        setRevokingId(shareId)
        try {
            await filesApi.revokeAccess({ shareId })
            queryClient.invalidateQueries({ queryKey: ['sharedFiles', user?.id] })
        } catch (err: unknown) {
            // Roll back
            setShares(prev => prev.map(s => s.id === shareId ? { ...s, revoked: false } : s))
            console.error('Revoke failed:', err)
        } finally {
            setRevokingId(null)
        }
    }

    // ── Copy public link ──────────────────────────────────────────────────────
    const copyPublicLink = async (share: ShareRecord) => {
        const base = window.location.origin + import.meta.env.BASE_URL
        const url = `${base}s/${share.token}`
        await navigator.clipboard.writeText(url)
        setCopiedTokenId(share.id)
        setTimeout(() => setCopiedTokenId(null), 2000)
    }

    // ── Share status label ────────────────────────────────────────────────────
    const shareStatus = (share: ShareRecord) => {
        if (share.revoked) return { label: 'Revoked', cls: 'text-red-600 bg-red-50' }
        if (share.expires_at && new Date(share.expires_at) < new Date()) return { label: 'Expired', cls: 'text-amber-600 bg-amber-50' }
        return { label: 'Active', cls: 'text-green-700 bg-green-50' }
    }

    // ── Today's date string (min for expiry picker) ───────────────────────────
    const today = new Date().toISOString().split('T')[0]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-vs-bg rounded-2xl shadow-2xl overflow-hidden flex flex-col
        animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">

                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-vs-border/50 flex items-start justify-between shrink-0 bg-vs-bg-subtle/50">
                    <div>
                        <h3 className="font-semibold text-base text-vs-text">Share File</h3>
                        <p className="text-xs text-vs-text-subtle truncate max-w-[280px]" title={fileName}>{fileName}</p>
                    </div>
                    <button onClick={onClose} className="text-vs-text-muted hover:text-vs-text transition-colors mt-0.5">✕</button>
                </div>

                {/* ── Tabs ── */}
                <div className="flex border-b border-vs-border/50 shrink-0">
                    {(['share', 'access'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${tab === t
                                    ? 'text-vs-primary border-b-2 border-vs-primary'
                                    : 'text-vs-text-subtle hover:text-vs-text'
                                }`}
                        >
                            {t === 'share' ? '+ Share' : '👥 Who has access'}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ── */}
                <div className="overflow-y-auto flex-1">

                    {/* ─ SHARE TAB ─ */}
                    {tab === 'share' && (
                        <form onSubmit={handleShare} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-vs-text-muted uppercase tracking-wide">Recipient Email</label>
                                <input
                                    type="email"
                                    required
                                    placeholder="alice@example.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    disabled={shareLoading || !!shareSuccess}
                                    className="w-full px-3 py-2 rounded-lg border border-vs-border bg-vs-bg text-sm
                    focus:outline-none focus:ring-2 focus:ring-vs-primary/50 focus:border-vs-primary transition-all"
                                />
                            </div>

                            {/* Permissions */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-vs-text-muted uppercase tracking-wide">Permissions</p>
                                {[
                                    { key: 'canDownload', label: 'Can Download', value: canDownload, set: setCanDownload, desc: 'Recipient can download the file' },
                                    { key: 'canReshare', label: 'Can Re-share', value: canReshare, set: setCanReshare, desc: 'Recipient can share with others' },
                                ].map(({ key, label, value, set, desc }) => (
                                    <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-vs-border hover:border-vs-primary/30 cursor-pointer transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-vs-text">{label}</p>
                                            <p className="text-xs text-vs-text-subtle">{desc}</p>
                                        </div>
                                        <div
                                            onClick={() => set(!value)}
                                            className={`w-9 h-5 rounded-full transition-colors duration-200 relative shrink-0 cursor-pointer
                        ${value ? 'bg-vs-primary' : 'bg-vs-border'}`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                        ${value ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {/* Expiry */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-vs-text-muted uppercase tracking-wide">
                                    Expiry Date <span className="normal-case text-vs-text-subtle font-normal">(optional)</span>
                                </label>
                                <input
                                    type="date"
                                    min={today}
                                    value={expiryDate}
                                    onChange={e => setExpiryDate(e.target.value)}
                                    disabled={shareLoading}
                                    className="w-full px-3 py-2 rounded-lg border border-vs-border bg-vs-bg text-sm
                    focus:outline-none focus:ring-2 focus:ring-vs-primary/50 focus:border-vs-primary transition-all"
                                />
                            </div>

                            {shareError && (
                                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100">{shareError}</div>
                            )}
                            {shareSuccess && (
                                <div className="p-3 text-sm text-green-700 bg-green-50 rounded-lg border border-green-100">✓ {shareSuccess}</div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={onClose} disabled={shareLoading}
                                    className="px-4 py-2 text-sm font-medium text-vs-text-subtle hover:text-vs-text bg-vs-bg-subtle hover:bg-vs-border/50 rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={shareLoading || !!shareSuccess || !email}
                                    className="px-4 py-2 text-sm font-medium text-white bg-vs-primary hover:bg-vs-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm">
                                    {shareLoading ? 'Encrypting & Sharing…' : 'Share File'}
                                </button>
                            </div>

                            <p className="text-center text-xs text-vs-text-subtle pt-1">
                                🔒 The file key is re-encrypted in your browser for the recipient's public key. The server never sees the plaintext.
                            </p>
                        </form>
                    )}

                    {/* ─ ACCESS TAB ─ */}
                    {tab === 'access' && (
                        <div className="p-6 space-y-3">
                            {sharesLoading ? (
                                <div className="space-y-2">
                                    {[1, 2].map(i => (
                                        <div key={i} className="h-16 rounded-lg bg-vs-border/30 animate-pulse" />
                                    ))}
                                </div>
                            ) : sharesError ? (
                                <div className="flex flex-col items-center gap-2 py-6 text-center">
                                    <p className="text-sm text-red-500">{sharesError}</p>
                                    <button onClick={loadShares} className="text-sm text-vs-primary hover:underline">Retry</button>
                                </div>
                            ) : shares.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-sm text-vs-text-subtle">This file has not been shared yet.</p>
                                    <button onClick={() => setTab('share')} className="mt-2 text-sm text-vs-primary hover:underline">Share it now</button>
                                </div>
                            ) : (
                                shares.map(share => {
                                    const status = shareStatus(share)
                                    const isActive = !share.revoked && !(share.expires_at && new Date(share.expires_at) < new Date())
                                    return (
                                        <div key={share.id} className="rounded-lg border border-vs-border bg-vs-bg-subtle/50 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    {/* Recipient ID (abbreviated) */}
                                                    <p className="text-xs font-mono text-vs-text truncate">
                                                        {share.shared_with ? share.shared_with.substring(0, 12) + '…' : 'Public link'}
                                                    </p>
                                                    <p className="text-xs text-vs-text-subtle">
                                                        Shared {new Date(share.created_at).toLocaleDateString()}
                                                        {share.expires_at && ` · Expires ${new Date(share.expires_at).toLocaleDateString()}`}
                                                    </p>
                                                    {/* Permission badges */}
                                                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                                        <ShareBadge label="Download" active={share.can_download} />
                                                        <ShareBadge label="Re-share" active={share.can_reshare} />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
                                                        {status.label}
                                                    </span>
                                                    {isActive && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {/* Copy link */}
                                                            <button
                                                                onClick={() => copyPublicLink(share)}
                                                                title="Copy shareable link"
                                                                className="text-xs text-vs-text-subtle hover:text-vs-primary transition-colors"
                                                            >
                                                                {copiedTokenId === share.id ? '✓ Copied' : '🔗 Copy link'}
                                                            </button>
                                                            {/* Revoke */}
                                                            <button
                                                                onClick={() => handleRevoke(share.id)}
                                                                disabled={revokingId === share.id}
                                                                className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                                                            >
                                                                {revokingId === share.id ? 'Revoking…' : 'Revoke'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
