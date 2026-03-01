/**
 * Decryption helpers - mirror of encrypt.ts.
 * All operations run in the browser via Web Crypto.
 */

import { base64ToArrayBuffer } from './utils'

/**
 * Decrypts a file ciphertext produced by encryptFile().
 *
 * @param ciphertext  Raw ciphertext ArrayBuffer
 * @param iv          The 12-byte IV used during encryption
 * @param fileKey     The AES-256-GCM key (unwrapped for this recipient)
 * @returns           Decrypted file bytes as ArrayBuffer
 */
export async function decryptFile(
    ciphertext: ArrayBuffer,
    iv: Uint8Array,
    fileKey: CryptoKey,
): Promise<ArrayBuffer> {
    // Slice creates a new Uint8Array backed by a proper ArrayBuffer (never SharedArrayBuffer)
    const safeIv = iv.slice(0) as Uint8Array<ArrayBuffer>
    return crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: safeIv },
        fileKey,
        ciphertext,
    )
}

/**
 * Decrypts metadata produced by encryptMetadata() and parses it back to an object.
 *
 * @param ciphertext  base64-encoded ciphertext string
 * @param iv          base64-encoded IV string
 * @param fileKey     The AES-256-GCM key (unwrapped for this recipient)
 * @returns           The original metadata object
 */
export async function decryptMetadata(
    ciphertext: string,
    iv: string,
    fileKey: CryptoKey,
): Promise<object> {
    const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv))
    const ciphertextBuffer = base64ToArrayBuffer(ciphertext)

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        fileKey,
        ciphertextBuffer,
    )

    return JSON.parse(new TextDecoder().decode(plaintext))
}
