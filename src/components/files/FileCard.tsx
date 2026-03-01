/**
 * FileCard – renders a single file with decrypted name, metadata, and actions.
 */
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../api/supabaseClient'
import { DownloadButton } from './DownloadButton'
import { AuditLogPanel } from './AuditLogPanel'
import { ShareModal } from '../sharing/ShareModal'
import { useAuthStore } from '../../store/authStore'
import type { DecryptedFile } from '../../types/files'

const MIME_ICON: Record<string, { emoji: string; color: string }> = {
    'application/pdf': { emoji: '📄', color: 'bg-red-50 text-red-600' },
    'image/jpeg': { emoji: '🖼', color: 'bg-purple-50 text-purple-600' },
    'image/png': { emoji: '🖼', color: 'bg-purple-50 text-purple-600' },
    'image/gif': { emoji: '🖼', color: 'bg-purple-50 text-purple-600' },
    'image/webp': { emoji: '🖼', color: 'bg-purple-50 text-purple-600' },
    'video/mp4': { emoji: '🎬', color: 'bg-pink-50 text-pink-600' },
    'audio/mpeg': { emoji: '🎵', color: 'bg-yellow-50 text-yellow-600' },
    'application/zip': { emoji: '🗜', color: 'bg-orange-50 text-orange-600' },
    'text/plain': { emoji: '📝', color: 'bg-gray-50 text-gray-600' },
    'application/json': { emoji: '{ }', color: 'bg-emerald-50 text-emerald-600' },
    'default': { emoji: '📁', color: 'bg-indigo-50 text-indigo-600' },
}

function getMimeInfo(mimeType: string) {
    return MIME_ICON[mimeType] ?? MIME_ICON['default']
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface FileCardProps {
    file: DecryptedFile
}

export function FileCard({ file }: FileCardProps) {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [shareOpen, setShareOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const mimeInfo = getMimeInfo(file.mimeType)
    const isDecryptionFailed = file.name === '(Decryption failed)' || !file.wrappedKeyBase64

    const handleDelete = async () => {
        if (!confirmDelete) { setConfirmDelete(true); return }
        try {
            setDeleting(true)
            const { error } = await supabase.from('files').delete().eq('id', file.id)
            if (error) throw error
            queryClient.invalidateQueries({ queryKey: ['files', user?.id] })
        } catch (err) {
            console.error('Delete failed:', err)
            setDeleting(false)
            setConfirmDelete(false)
        }
    }

    return (
        <>
            <div className="group relative rounded-xl border border-vs-border bg-vs-bg p-4 flex flex-col gap-3
        hover:border-vs-primary/40 hover:shadow-sm transition-all duration-150">

                {/* Header row */}
                <div className="flex items-start gap-3">
                    {/* File type icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg font-bold ${mimeInfo.color}`}>
                        {mimeInfo.emoji}
                    </div>

                    {/* File info */}
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isDecryptionFailed ? 'text-vs-text-subtle italic' : 'text-vs-text'}`}
                            title={file.name}>
                            {file.name}
                        </p>
                        <p className="text-xs text-vs-text-subtle mt-0.5">
                            {formatBytes(file.size)} · {new Date(file.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>

                    {/* Expiry badge */}
                    {file.expires_at && (
                        <span className="shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md">
                            Expires {new Date(file.expires_at).toLocaleDateString()}
                        </span>
                    )}
                </div>

                {/* Action row */}
                <div className="flex items-center gap-4 border-t border-vs-border/50 pt-2.5">
                    {/* Download */}
                    {!isDecryptionFailed ? (
                        <DownloadButton
                            fileId={file.id}
                            fileName={file.name}
                            mimeType={file.mimeType}
                            ivBase64={file.ivBase64}
                            wrappedKeyBase64={file.wrappedKeyBase64}
                        />
                    ) : (
                        <span className="text-xs text-vs-text-subtle italic">Key unavailable</span>
                    )}


                    {/* Share (opens unified modal with both tabs) */}
                    {!isDecryptionFailed && (
                        <button
                            onClick={() => setShareOpen(true)}
                            className="text-sm font-medium text-vs-text-subtle hover:text-vs-text transition-colors"
                        >
                            Share
                        </button>
                    )}

                    {/* Delete — pushes to right */}
                    <div className="ml-auto">
                        {confirmDelete ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-red-500">Confirm?</span>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting…' : 'Yes, delete'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-xs text-vs-text-subtle hover:text-vs-text"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleDelete}
                                className="text-xs text-vs-text-subtle hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Audit log */}
            <AuditLogPanel fileId={file.id} />

            {/* Unified share modal (has "Share" + "Who has access" tabs) */}
            {shareOpen && !isDecryptionFailed && (
                <ShareModal
                    isOpen={shareOpen}
                    onClose={() => setShareOpen(false)}
                    fileId={file.id}
                    fileName={file.name}
                    wrappedKeyBase64={file.wrappedKeyBase64}
                />
            )}
        </>
    )
}
