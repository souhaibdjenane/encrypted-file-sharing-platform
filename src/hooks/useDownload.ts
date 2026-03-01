/**
 * useDownload – per-file download + decryption state machine.
 *
 * States: idle → presigning → fetching → decrypting → done → error
 *                                                            ↓
 *                                                          idle (via reset)
 */
import { useState, useCallback } from 'react'
import { filesApi } from '../api/filesApi'
import { unwrapFileKey } from '../crypto/keyWrap'
import { decryptFile } from '../crypto/decrypt'
import { base64ToArrayBuffer } from '../crypto/utils'
import { useCrypto } from '../contexts/CryptoContext'

export type DownloadStage = 'idle' | 'presigning' | 'fetching' | 'decrypting' | 'done' | 'error'

export function useDownload(
    fileId: string,
    fileName: string,
    mimeType: string,
    ivBase64: string,
    wrappedKeyBase64: string,
) {
    const { keyPair } = useCrypto()
    const [stage, setStage] = useState<DownloadStage>('idle')
    const [error, setError] = useState<string | null>(null)

    const reset = useCallback(() => {
        setStage('idle')
        setError(null)
    }, [])

    const download = useCallback(async () => {
        if (!keyPair) {
            setError('Encryption keys not ready.')
            setStage('error')
            return
        }
        if (!wrappedKeyBase64 || !ivBase64) {
            setError('Cannot decrypt this file — key is missing.')
            setStage('error')
            return
        }

        try {
            // ── 1. Get presigned download URL ────────────────────────────────────
            setStage('presigning')
            const { signedUrl } = await filesApi.getDownloadPresignUrl({ fileId })

            // ── 2. Fetch encrypted blob ──────────────────────────────────────────
            setStage('fetching')
            const response = await fetch(signedUrl)
            if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
            const encryptedBuffer = await response.arrayBuffer()

            // ── 3. Decrypt ───────────────────────────────────────────────────────
            setStage('decrypting')
            const fileKey = await unwrapFileKey(wrappedKeyBase64, keyPair.privateKey)
            const ivBuffer = new Uint8Array(base64ToArrayBuffer(ivBase64))
            const plainBuffer = await decryptFile(encryptedBuffer, ivBuffer, fileKey)

            // ── 4. Trigger browser download ──────────────────────────────────────
            const blob = new Blob([plainBuffer], { type: mimeType })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setStage('done')
            // Auto-reset after a short success window so the button goes back to normal
            setTimeout(() => setStage('idle'), 2500)

        } catch (err: unknown) {
            console.error('[useDownload]', err)
            const raw = err instanceof Error ? err.message : 'Unknown error'
            // Sanitise — never surface raw crypto internals
            const userMsg = raw.includes('key') || raw.includes('decrypt') || raw.includes('crypto')
                ? 'Decryption failed. Your key may not match this file.'
                : raw
            setError(userMsg)
            setStage('error')
        }
    }, [fileId, fileName, mimeType, ivBase64, wrappedKeyBase64, keyPair])

    return { download, reset, stage, error }
}
