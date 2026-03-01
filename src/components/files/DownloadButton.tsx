/**
 * DownloadButton — inline download + decryption indicator.
 * Shows: icon → spinner (when active) → checkmark (on success)
 */
import React from 'react'
import { useDownload } from '../../hooks/useDownload'

interface DownloadButtonProps {
    fileId: string
    fileName: string
    mimeType: string
    ivBase64: string
    wrappedKeyBase64: string
    className?: string
}

export function DownloadButton({
    fileId,
    fileName,
    mimeType,
    ivBase64,
    wrappedKeyBase64,
    className = '',
}: DownloadButtonProps) {
    const { download, reset, stage, error } = useDownload(
        fileId, fileName, mimeType, ivBase64, wrappedKeyBase64,
    )

    const isActive = stage !== 'idle' && stage !== 'done' && stage !== 'error'

    const label: Record<typeof stage, string> = {
        idle: 'Download',
        presigning: 'Preparing…',
        fetching: 'Fetching…',
        decrypting: 'Decrypting…',
        done: '✓ Downloaded',
        error: 'Retry',
    }

    const handleClick = () => {
        if (stage === 'error') { reset(); return }
        if (stage === 'idle') download()
    }

    return (
        <div className="flex flex-col items-start gap-1">
            <button
                onClick={handleClick}
                disabled={isActive || stage === 'done'}
                title={error ?? undefined}
                className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors
          ${stage === 'done'
                        ? 'text-green-600 cursor-default'
                        : stage === 'error'
                            ? 'text-red-500 hover:text-red-700'
                            : 'text-vs-primary hover:text-vs-primary/80 disabled:opacity-50 disabled:cursor-wait'
                    } ${className}`}
            >
                {/* icon */}
                {isActive ? (
                    // spinner
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : stage === 'done' ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                )}
                {label[stage]}
            </button>
            {stage === 'error' && error && (
                <p className="text-xs text-red-500 max-w-[180px] leading-tight">{error}</p>
            )}
        </div>
    )
}
