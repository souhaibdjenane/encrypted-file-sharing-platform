/**
 * PublicSharePage — /s/:token
 * 
 * Public page: no auth required.
 * The AES file key lives in the URL hash (#key=BASE64) — never sent to server.
 * Pressing "Download" fetches the encrypted blob via the token and decrypts locally.
 */
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../api/supabaseClient'
import { base64ToArrayBuffer } from '../crypto/utils'
import { decryptFile } from '../crypto/decrypt'

type PageState = 'loading' | 'ready' | 'downloading' | 'done' | 'error'

export function PublicSharePage() {
    const { token } = useParams<{ token: string }>()
    const [pageState, setPageState] = useState<PageState>('loading')
    const [fileName, setFileName] = useState<string>('Encrypted file')
    const [error, setError] = useState<string | null>(null)
    // The raw AES key base64 read from hash (e.g. #key=ABC…)
    const [rawKeyB64, setRawKeyB64] = useState<string | null>(null)

    useEffect(() => {
        // Parse the #key= fragment — never leaves the browser
        const hash = window.location.hash  // e.g. "#key=BASE64"
        const match = hash.match(/[#&]key=([A-Za-z0-9+/=]+)/)
        if (match?.[1]) {
            setRawKeyB64(match[1])
        }

        // Validate the share token (just check it exists + not revoked)
        const checkToken = async () => {
            if (!token) { setError('Invalid share link.'); setPageState('error'); return }

            const { data, error: fetchError } = await supabase
                .from('shares')
                .select('id, revoked, expires_at, can_download, file_id')
                .eq('token', token)
                .maybeSingle()

            if (fetchError || !data) {
                setError('Share link not found or has expired.')
                setPageState('error')
                return
            }
            if (data.revoked) {
                setError('This share link has been revoked by the owner.')
                setPageState('error')
                return
            }
            if (data.expires_at && new Date(data.expires_at) < new Date()) {
                setError('This share link has expired.')
                setPageState('error')
                return
            }
            if (!data.can_download) {
                setError('This link does not grant download access.')
                setPageState('error')
                return
            }

            // Try to get a preview name from the file (metadata is still encrypted so show placeholder)
            setFileName('Encrypted file')
            setPageState('ready')
        }

        checkToken()
    }, [token])

    const handleDownload = async () => {
        if (!token || !rawKeyB64) {
            setError('No decryption key found in this link. Make sure you copied the full URL.')
            setPageState('error')
            return
        }

        setPageState('downloading')
        setError(null)

        try {
            // 1. Call download-presign with token (no JWT)
            const res = await supabase.functions.invoke('download-presign', {
                body: { token },
            })
            if (res.error) throw new Error(res.error.message)
            const { signedUrl } = res.data as { signedUrl: string }

            // 2. Fetch encrypted blob
            const blobRes = await fetch(signedUrl)
            if (!blobRes.ok) throw new Error(`Download failed: HTTP ${blobRes.status}`)
            const encryptedBuffer = await blobRes.arrayBuffer()

            // 3. Reconstruct the AES-GCM key from raw base64 bytes
            const rawKey = base64ToArrayBuffer(rawKeyB64)
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt'],
            )

            // 4. Extract IV — stored as the first 12 bytes of the ciphertext for public links
            // The IV is prepended by our upload flow
            // Actually, IV is stored separately in DB. We need to get it.
            // Since we don't have the IV from just the token, we must fetch the file record.
            // Get iv from files table via the share
            const { data: shareRow } = await supabase
                .from('shares')
                .select('file_id')
                .eq('token', token)
                .maybeSingle()

            if (!shareRow) throw new Error('Share record not found')

            const { data: fileRow } = await supabase
                .from('files')
                .select('iv')
                .eq('id', shareRow.file_id)
                .maybeSingle()

            if (!fileRow) throw new Error('File record not found')

            const ivBuffer = new Uint8Array(base64ToArrayBuffer(fileRow.iv))

            // 5. Decrypt
            const plainBuffer = await decryptFile(encryptedBuffer, ivBuffer, cryptoKey)

            // 6. Trigger browser download
            const blob = new Blob([plainBuffer])
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setPageState('done')
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            const userMsg = msg.includes('decrypt') || msg.includes('key') || msg.includes('crypto')
                ? 'Decryption failed. This link may be incomplete or the file has been modified.'
                : msg
            setError(userMsg)
            setPageState('error')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-vs-bg px-4">
            <div className="w-full max-w-sm text-center space-y-6">
                {/* Logo / Brand */}
                <div>
                    <p className="text-2xl font-bold text-vs-text tracking-tight">VaultShare</p>
                    <p className="text-xs text-vs-text-subtle mt-1">End-to-end encrypted file sharing</p>
                </div>

                <div className="rounded-2xl border border-vs-border bg-vs-bg p-8 space-y-5 shadow-sm">
                    {/* State icon */}
                    <div className="w-14 h-14 mx-auto rounded-full bg-vs-primary/10 flex items-center justify-center">
                        {pageState === 'loading' && (
                            <svg className="w-7 h-7 text-vs-primary animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {pageState === 'ready' && (
                            <svg className="w-7 h-7 text-vs-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            </svg>
                        )}
                        {(pageState === 'downloading') && (
                            <svg className="w-7 h-7 text-vs-primary animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {pageState === 'done' && (
                            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {pageState === 'error' && (
                            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        )}
                    </div>

                    {/* Message */}
                    {pageState === 'loading' && <p className="text-sm text-vs-text-subtle">Validating share link…</p>}
                    {pageState === 'ready' && (
                        <>
                            <div>
                                <p className="text-sm font-semibold text-vs-text">You have a secure file</p>
                                <p className="text-xs text-vs-text-subtle mt-1">
                                    This file is encrypted. Clicking download will decrypt it locally in your browser.
                                </p>
                            </div>
                            {!rawKeyB64 && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                    ⚠️ Decryption key not found in the URL. Make sure you copied the <em>full</em> link including the <code>#key=…</code> part.
                                </p>
                            )}
                            <button
                                onClick={handleDownload}
                                disabled={!rawKeyB64}
                                className="w-full py-2.5 text-sm font-medium text-white bg-vs-primary hover:bg-vs-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
                            >
                                🔓 Decrypt &amp; Download
                            </button>
                        </>
                    )}
                    {pageState === 'downloading' && (
                        <p className="text-sm text-vs-text-subtle">Decrypting in your browser…</p>
                    )}
                    {pageState === 'done' && (
                        <p className="text-sm text-green-700 font-medium">✓ File downloaded successfully!</p>
                    )}
                    {pageState === 'error' && error && (
                        <div className="space-y-3">
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                                onClick={() => { setPageState('ready'); setError(null) }}
                                className="text-sm text-vs-primary hover:underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-xs text-vs-text-subtle">
                    🔒 Decryption happens in your browser. This server never sees your file contents.
                </p>
            </div>
        </div>
    )
}
