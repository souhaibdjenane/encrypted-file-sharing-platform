/**
 * AuditLogPanel — collapsible file activity feed.
 * Fetches audit_logs for a file (RLS ensures only the owner sees their file's logs).
 */
import React, { useState } from 'react'
import { supabase } from '../../api/supabaseClient'

interface AuditEntry {
    id: number
    action: string
    user_id: string | null
    created_at: string
    metadata: Record<string, unknown> | null
}

const ACTION_ICONS: Record<string, string> = {
    upload: '📤',
    download: '📥',
    download_public: '📥',
    share: '🔗',
    revoke: '🚫',
}

const ACTION_LABELS: Record<string, string> = {
    upload: 'Uploaded',
    download: 'Downloaded',
    download_public: 'Downloaded via public link',
    share: 'Shared',
    revoke: 'Access revoked',
}

interface AuditLogPanelProps {
    fileId: string
}

export function AuditLogPanel({ fileId }: AuditLogPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)

    const loadLogs = async () => {
        if (loaded) return   // only fetch once per mount
        setIsLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase
                .from('audit_logs')
                .select('id, action, user_id, created_at, metadata')
                .eq('file_id', fileId)
                .order('created_at', { ascending: false })
                .limit(30)

            if (fetchError) throw new Error(fetchError.message)
            setEntries(data ?? [])
            setLoaded(true)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load activity')
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggle = () => {
        const next = !isOpen
        setIsOpen(next)
        if (next && !loaded) loadLogs()
    }

    const maskUserId = (userId: string | null) => {
        if (!userId) return 'Anonymous'
        return userId.substring(0, 8) + '…'
    }

    return (
        <div className="border-t border-vs-border/50 mt-1">
            {/* Toggle button */}
            <button
                onClick={handleToggle}
                className="w-full flex items-center justify-between px-4 py-2 text-xs text-vs-text-subtle hover:text-vs-text hover:bg-vs-bg-subtle/50 transition-colors"
            >
                <span className="font-medium">Activity Log</span>
                <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Log list */}
            {isOpen && (
                <div className="px-4 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
                    {isLoading && (
                        <p className="text-xs text-vs-text-subtle py-2">Loading…</p>
                    )}
                    {error && (
                        <p className="text-xs text-red-500 py-1">{error}</p>
                    )}
                    {!isLoading && !error && entries.length === 0 && (
                        <p className="text-xs text-vs-text-subtle py-2">No activity recorded yet.</p>
                    )}
                    {entries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 py-1">
                            <span className="text-sm shrink-0" role="img" aria-label={entry.action}>
                                {ACTION_ICONS[entry.action] ?? '📋'}
                            </span>
                            <div className="flex-1 min-w-0">
                                <span className="text-xs text-vs-text">
                                    {ACTION_LABELS[entry.action] ?? entry.action}
                                </span>
                                <span className="text-xs text-vs-text-subtle ml-1">
                                    by {maskUserId(entry.user_id)}
                                </span>
                            </div>
                            <span className="text-[10px] text-vs-text-subtle shrink-0" title={entry.created_at}>
                                {new Date(entry.created_at).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
