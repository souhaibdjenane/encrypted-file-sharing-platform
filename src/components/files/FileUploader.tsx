/**
 * FileUploader — drag-and-drop zone with staged progress animation.
 *
 * Stages: idle → encrypting → uploading → saving → done → error
 */
import React, { useCallback, useRef, useState } from 'react'
import { useUpload, type UploadStage } from '../../hooks/useUpload'

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const STAGE_LABELS: Record<UploadStage, string> = {
    idle: '',
    encrypting: 'Encrypting…',
    uploading: 'Uploading…',
    saving: 'Saving…',
    done: 'Done ✓',
    error: '',
}

const STAGE_PROGRESS: Record<UploadStage, number> = {
    idle: 0,
    encrypting: 20,
    uploading: 60,   // actual XHR progress fills this range
    saving: 95,
    done: 100,
    error: 0,
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StageIndicator({ stage, progress }: { stage: UploadStage; progress: number }) {
    const stages: UploadStage[] = ['encrypting', 'uploading', 'saving', 'done']
    const activeIdx = stages.indexOf(stage)

    // Compute the visual progress bar width
    const barWidth = stage === 'uploading'
        ? STAGE_PROGRESS.encrypting + (progress / 100) * (STAGE_PROGRESS.uploading - STAGE_PROGRESS.encrypting)
        : STAGE_PROGRESS[stage]

    if (stage === 'idle' || stage === 'error') return null

    return (
        <div className="w-full space-y-3">
            {/* Step pills */}
            <div className="flex items-center gap-2">
                {stages.map((s, i) => {
                    const isCurrent = s === stage
                    const isDone = activeIdx > i

                    return (
                        <React.Fragment key={s}>
                            {i > 0 && (
                                <div className={`flex-1 h-px transition-colors duration-500 ${isDone ? 'bg-vs-primary' : 'bg-vs-border'}`} />
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full transition-all duration-300 whitespace-nowrap
                ${isDone
                                    ? 'bg-vs-primary/15 text-vs-primary'
                                    : isCurrent
                                        ? 'bg-vs-primary text-white shadow-sm shadow-vs-primary/30 scale-105'
                                        : 'bg-vs-border/50 text-vs-text-subtle'
                                }`}>
                                {STAGE_LABELS[s]}
                            </span>
                        </React.Fragment>
                    )
                })}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-vs-border rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-vs-primary to-vs-secondary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${barWidth}%` }}
                />
            </div>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function FileUploader() {
    const { upload, reset, stage, progress, error, fileName } = useUpload()
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)
    const [preview, setPreview] = useState<{ name: string; size: number; type: string } | null>(null)

    const isActive = stage !== 'idle' && stage !== 'done' && stage !== 'error'
    const isDone = stage === 'done'

    const startUpload = useCallback((file: File) => {
        setPreview({ name: file.name, size: file.size, type: file.type })
        upload(file)
    }, [upload])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) startUpload(file)
        // Reset input so the same file can be re-selected after reset
        e.target.value = ''
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file && !isActive) startUpload(file)
    }, [isActive, startUpload])

    const handleReset = () => {
        reset()
        setPreview(null)
    }

    return (
        <div className="space-y-3">
            {/* Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); if (!isActive) setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => { if (!isActive && !isDone) inputRef.current?.click() }}
                className={`relative rounded-2xl border-2 border-dashed p-8 flex flex-col items-center gap-4 text-center
          transition-all duration-200 select-none
          ${isActive
                        ? 'border-vs-primary/50 bg-vs-primary/5 cursor-wait'
                        : isDone
                            ? 'border-green-400/60 bg-green-50/40 cursor-default'
                            : dragOver
                                ? 'border-vs-primary bg-vs-primary/8 scale-[1.01] cursor-copy'
                                : 'border-vs-border hover:border-vs-primary/60 hover:bg-vs-bg-subtle cursor-pointer'
                    }`}
            >
                {/* Hidden file input */}
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isActive || isDone}
                />

                {/* Central icon */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300
          ${isDone
                        ? 'bg-green-100 text-green-600'
                        : isActive
                            ? 'bg-vs-primary/10 text-vs-primary'
                            : dragOver
                                ? 'bg-vs-primary/15 text-vs-primary scale-110'
                                : 'bg-vs-bg-subtle text-vs-text-subtle group-hover:bg-vs-primary/10'
                    }`}>
                    {isDone ? (
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : isActive ? (
                        <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                    )}
                </div>

                {/* Text content */}
                {isDone ? (
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-green-700">
                            {fileName ?? preview?.name} encrypted &amp; uploaded
                        </p>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleReset() }}
                            className="text-xs text-green-600 hover:text-green-800 underline underline-offset-2"
                        >
                            Upload another file
                        </button>
                    </div>
                ) : preview && isActive ? (
                    <div className="space-y-1 pointer-events-none">
                        <p className="text-sm font-semibold text-vs-text truncate max-w-xs">{preview.name}</p>
                        <p className="text-xs text-vs-text-subtle">{formatBytes(preview.size)} · {preview.type}</p>
                    </div>
                ) : (
                    <div className="space-y-1 pointer-events-none">
                        <p className="text-sm font-semibold text-vs-text">
                            {dragOver ? 'Drop to encrypt &amp; upload' : 'Drag a file here'}
                        </p>
                        <p className="text-xs text-vs-text-subtle">or click to browse · up to 500 MB</p>
                        <p className="text-xs text-vs-text-subtle/70 mt-1">
                            🔒 Encrypted in your browser — the server never sees your file
                        </p>
                    </div>
                )}

                {/* Stage progress (shown during active stages) */}
                {isActive && (
                    <div className="w-full max-w-sm">
                        <StageIndicator stage={stage} progress={progress} />
                    </div>
                )}
            </div>

            {/* Error banner */}
            {stage === 'error' && error && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 space-y-1">
                        <p>{error}</p>
                        <button
                            onClick={handleReset}
                            className="text-xs font-medium text-red-600 hover:text-red-800 underline underline-offset-2"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
