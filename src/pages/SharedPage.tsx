/**
 * SharedPage — /shared
 * Shows files that have been shared with the current user.
 */
import React from 'react'
import { useSharedFiles } from '../hooks/useSharedFiles'
import { DownloadButton } from '../components/files/DownloadButton'
import { AuditLogPanel } from '../components/files/AuditLogPanel'

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
    return (
        <div className="rounded-xl border border-vs-border bg-vs-bg p-4 flex flex-col gap-3 animate-pulse">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-vs-border/60 shrink-0" />
                <div className="flex-1 space-y-2 pt-0.5">
                    <div className="h-3.5 bg-vs-border/60 rounded w-3/4" />
                    <div className="h-3 bg-vs-border/40 rounded w-1/3" />
                </div>
            </div>
        </div>
    )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptySharedState() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-vs-primary/5 flex items-center justify-center">
                <svg className="w-10 h-10 text-vs-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-vs-text">No files shared with you yet</p>
                <p className="text-xs text-vs-text-subtle max-w-xs">
                    When someone shares an encrypted file with your account, it will appear here.
                </p>
            </div>
        </div>
    )
}

// ── File card (shared view — download only, no share/delete actions) ──────────
function SharedFileCard({ file }: { file: ReturnType<typeof useSharedFiles>['data'] extends Array<infer T> | undefined ? T : never }) {
    const mimeEmoji: Record<string, string> = {
        'application/pdf': '📄',
        'image/jpeg': '🖼', 'image/png': '🖼', 'image/webp': '🖼',
        'video/mp4': '🎬',
        'audio/mpeg': '🎵',
        'application/zip': '🗜',
        'text/plain': '📝',
        'application/json': '{ }',
    }
    const icon = mimeEmoji[file.mimeType] ?? '📁'

    const formatBytes = (b: number) => {
        if (!b) return '—'
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(b) / Math.log(k))
        return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
    }

    return (
        <div className="rounded-xl border border-vs-border bg-vs-bg overflow-hidden hover:border-vs-primary/40 hover:shadow-sm transition-all duration-150">
            <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-vs-text truncate" title={file.name}>{file.name}</p>
                        <p className="text-xs text-vs-text-subtle mt-0.5">
                            {formatBytes(file.size)} · {new Date(file.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {file.expires_at && (
                            <span className="inline-block mt-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                Expires {new Date(file.expires_at).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 border-t border-vs-border/50 pt-2.5">
                    {file.canDownload ? (
                        <DownloadButton
                            fileId={file.id}
                            fileName={file.name}
                            mimeType={file.mimeType}
                            ivBase64={file.ivBase64}
                            wrappedKeyBase64={file.wrappedKeyBase64}
                        />
                    ) : (
                        <span className="text-xs text-vs-text-subtle italic">Download not permitted</span>
                    )}
                    <span className="ml-auto text-xs text-vs-text-subtle">
                        Shared file
                    </span>
                </div>
            </div>
            {/* Activity log */}
            <AuditLogPanel fileId={file.id} />
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SharedPage() {
    const { data: files, isLoading, isError, error, refetch } = useSharedFiles()

    return (
        <div className="flex-1 px-4 py-12">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold text-vs-text">Shared with me</h1>
                    <p className="text-sm text-vs-text-subtle mt-1">
                        Encrypted files others have securely shared with your account.
                    </p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SkeletonCard /><SkeletonCard /><SkeletonCard />
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-red-500">{error instanceof Error ? error.message : 'Failed to load shared files'}</p>
                        <button onClick={() => refetch()} className="text-sm text-vs-primary hover:underline">Try again</button>
                    </div>
                ) : !files || files.length === 0 ? (
                    <EmptySharedState />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {files.map(file => <SharedFileCard key={file.shareId} file={file} />)}
                    </div>
                )}
            </div>
        </div>
    )
}
