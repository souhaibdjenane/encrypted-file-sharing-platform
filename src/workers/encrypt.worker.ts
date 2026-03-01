/**
 * Encryption Web Worker — exposed via Comlink.
 */
import { expose } from 'comlink'
import { encryptFile as _encryptFile, encryptMetadata as _encryptMetadata } from '../crypto/encrypt'

// Global error handling to catch initialization crashes
self.addEventListener('error', (e) => {
    console.error('[Worker] Global Script Error:', e.message, 'at', e.filename, ':', e.lineno)
})

self.addEventListener('unhandledrejection', (e) => {
    console.error('[Worker] Unhandled Promise Rejection:', e.reason)
})

console.log('[Worker] Initializing script...')

const api = {
    /**
     * Simple connectivity test.
     */
    async ping(): Promise<string> {
        console.log('[Worker] Ping received')
        return 'pong'
    },

    /**
     * Encrypts the file and returns ciphertext, IV, and the raw AES key bytes.
     */
    async encryptFile(file: File): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array; rawKey: ArrayBuffer }> {
        console.log('[Worker] Starting encryptFile for:', file.name, file.size)
        try {
            const { ciphertext, iv, fileKey } = await _encryptFile(file)
            console.log('[Worker] File encryption complete, exporting key...')

            const rawKey = await crypto.subtle.exportKey('raw', fileKey)
            console.log('[Worker] Key export complete')

            return { ciphertext, iv, rawKey }
        } catch (err) {
            console.error('[Worker] Error in encryptFile:', err)
            throw err
        }
    },

    /**
     * Encrypts metadata using a raw key.
     */
    async encryptMetadata(
        metadata: object,
        rawKey: ArrayBuffer,
    ): Promise<{ ciphertext: string; iv: string }> {
        console.log('[Worker] Starting encryptMetadata')
        try {
            const fileKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt'],
            )
            const result = await _encryptMetadata(metadata, fileKey)
            console.log('[Worker] Metadata encryption complete')
            return result
        } catch (err) {
            console.error('[Worker] Error in encryptMetadata:', err)
            throw err
        }
    },
}

try {
    expose(api)
    console.log('[Worker] API exposed successfully')
} catch (err) {
    console.error('[Worker] Critical failure exposing API:', err)
}
