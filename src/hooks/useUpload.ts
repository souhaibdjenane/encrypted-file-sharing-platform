/**
 * useUpload – state-machine hook for the full E2E upload pipeline.
 *
 * States:   idle → encrypting → uploading → saving → done → error
 *           (any state can transition to error)
 *           done / error → idle via reset()
 *
 * v2: magic byte validation before encryption, encryption runs in a
 *     Web Worker (via Comlink) so the UI thread stays responsive.
 */
import { useState, useCallback } from 'react'
import { wrap } from 'comlink'
import type { Remote } from 'comlink'
import { useQueryClient } from '@tanstack/react-query'
import { wrapFileKey } from '../crypto/keyWrap'
import { arrayBufferToBase64 } from '../crypto/utils'
import { validateFileType } from '../crypto/magicBytes'
import { filesApi } from '../api/filesApi'
import { useCrypto } from '../contexts/CryptoContext'
import { useAuthStore } from '../store/authStore'
// @ts-ignore - Vite specific syntax
import EncryptWorkerInstance from '../workers/encrypt.worker?worker'

// Worker type — matches pill in encrypt.worker.ts
type EncryptWorker = {
    ping: () => Promise<string>
    encryptFile: (file: File) => Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array; rawKey: ArrayBuffer }>
    encryptMetadata: (meta: object, rawKey: ArrayBuffer) => Promise<{ ciphertext: string; iv: string }>
}

export type UploadStage = 'idle' | 'encrypting' | 'uploading' | 'saving' | 'done' | 'error'

export interface UploadState {
    stage: UploadStage
    progress: number        // 0-100 for the uploading stage
    error: string | null
    fileName: string | null // name of the file last uploaded successfully
}

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

export function useUpload() {
    const queryClient = useQueryClient()
    const { keyPair } = useCrypto()
    const { user } = useAuthStore()

    const [state, setState] = useState<UploadState>({
        stage: 'idle',
        progress: 0,
        error: null,
        fileName: null,
    })

    const reset = useCallback(() => {
        setState({ stage: 'idle', progress: 0, error: null, fileName: null })
    }, [])

    const upload = useCallback(async (file: File) => {
        if (!keyPair || !user) {
            setState(s => ({ ...s, stage: 'error', error: 'You must be logged in with encryption keys ready.' }))
            return
        }

        // ── Guard: file size ─────────────────────────────────────────────────────
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setState(s => ({ ...s, stage: 'error', error: 'File exceeds the 500 MB limit.' }))
            return
        }

        // ── Guard: magic byte type validation ────────────────────────────────────
        const typeCheck = await validateFileType(file)
        if (!typeCheck.valid) {
            setState(s => ({ ...s, stage: 'error', error: typeCheck.reason ?? 'Unsupported file type.' }))
            return
        }

        // Spin up a short-lived encryption worker
        let worker: Worker | null = null
        let workerApi: Remote<EncryptWorker> | null = null

        try {
            // ── Stage 1: Encrypting (off-thread) ─────────────────────────────────
            setState({ stage: 'encrypting', progress: 0, error: null, fileName: file.name })

            console.log('[useUpload] Creating worker instance...')
            try {
                worker = new EncryptWorkerInstance()
                console.log('[useUpload] Worker instance created:', worker)
            } catch (err) {
                console.error('[useUpload] CRITICAL: Failed to construct worker instance. This usually indicates a 404 or bundling error.', err)
                throw err
            }

            workerApi = wrap<EncryptWorker>(worker)

            // Verify connectivity with a timeout
            console.log('[useUpload] Pinging worker (timeout: 10s)...')
            const pingPromise = workerApi.ping()
            // Increase timeout to 10s for slower environments
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Worker initialization timed out (10s). Check CSP or 404s.')), 10000))

            const pong = await (Promise.race([pingPromise, timeoutPromise]) as Promise<string>)
            console.log('[useUpload] Worker responded:', pong)

            const { ciphertext, iv, rawKey } = await workerApi.encryptFile(file)
            const encryptedMeta = await workerApi.encryptMetadata(
                { name: file.name, size: file.size, type: file.type },
                rawKey,
            )
            // Re-import raw key on main thread so wrapFileKey can use it
            const fileKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt'],
            )
            const wrappedKey = await wrapFileKey(fileKey, keyPair.publicKey)
            const ivBase64 = arrayBufferToBase64(iv instanceof Uint8Array ? iv.buffer as ArrayBuffer : iv)

            // ── Stage 2: Uploading ───────────────────────────────────────────────
            setState(s => ({ ...s, stage: 'uploading', progress: 0 }))

            const { signedUrl, storagePath } = await filesApi.getUploadPresignUrl({
                fileName: file.name,
                contentType: 'application/octet-stream',
                fileSize: ciphertext.byteLength,
            })

            // XHR gives real upload progress
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        setState(s => ({ ...s, progress: Math.round((e.loaded / e.total) * 100) }))
                    }
                })
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve()
                    else reject(new Error(`Upload failed: HTTP ${xhr.status}`))
                })
                xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
                xhr.open('PUT', signedUrl)
                xhr.setRequestHeader('Content-Type', 'application/octet-stream')
                xhr.send(ciphertext)
            })

            // ── Stage 3: Saving metadata ─────────────────────────────────────────
            setState(s => ({ ...s, stage: 'saving', progress: 100 }))

            const fileId = crypto.randomUUID()
            await filesApi.insertFileAndKey(
                {
                    id: fileId,
                    owner_id: user.id,
                    storage_path: storagePath,
                    encrypted_metadata: encryptedMeta,
                    file_size_bytes: file.size,
                    mime_type: file.type,
                    iv: ivBase64,
                },
                wrappedKey,
            )

            // ── Done ─────────────────────────────────────────────────────────────
            setState(s => ({ ...s, stage: 'done' }))
            queryClient.invalidateQueries({ queryKey: ['files', user.id] })

        } catch (err: unknown) {
            console.error('[useUpload]', err)
            const msg = err instanceof Error ? err.message : 'Upload failed'
            const userMsg = msg.includes('key') || msg.includes('crypto') || msg.includes('decrypt')
                ? 'Encryption error. Please try again.'
                : msg
            setState(s => ({ ...s, stage: 'error', error: userMsg }))
        } finally {
            // Always terminate the worker to free memory
            worker?.terminate()
        }
    }, [keyPair, user, queryClient])

    return { upload, reset, ...state }
}
