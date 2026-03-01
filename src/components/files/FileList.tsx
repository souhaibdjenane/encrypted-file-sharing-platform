/**
 * FileList — React Query-powered file grid with skeleton loading and empty state.
 */
import React from 'react'
import { useFiles } from '../../hooks/useFiles'
import { FileCard } from './FileCard'

// ── Skeleton card ──────────────────────────────────────────────────────────────
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
            <div className="border-t border-vs-border/50 pt-2.5 flex gap-4">
                <div className="h-3 bg-vs-border/40 rounded w-16" />
                <div className="h-3 bg-vs-border/40 rounded w-10" />
            </div>
        </div>
    )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
            {/* Vault illustration */}
            <div className="w-20 h-20 rounded-full bg-vs-primary/5 flex items-center justify-center">
                <svg
                    className="w-10 h-10 text-vs-primary/40"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                >
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-vs-text">No encrypted files yet</p>
                <p className="text-xs text-vs-text-subtle max-w-xs">
                    Drag a file into the upload zone above — it will be encrypted in your browser before leaving your device.
                </p>
            </div>
        </div>
    )
}

// ── Main FileList ──────────────────────────────────────────────────────────────
export function FileList() {
    const { data: files, isLoading, isError, error, refetch } = useFiles()

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-red-500">
                    Failed to load your vault.{' '}
                    {error instanceof Error ? error.message : ''}
                </p>
                <button
                    onClick={() => refetch()}
                    className="text-sm font-medium text-vs-primary hover:underline"
                >
                    Try again
                </button>
            </div>
        )
    }

    if (!files || files.length === 0) {
        return <EmptyState />
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map(file => (
                <FileCard key={file.id} file={file} />
            ))}
        </div>
    )
}
