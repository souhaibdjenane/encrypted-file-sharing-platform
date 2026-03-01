/**
 * Encryption helpers.
 * Never sends data to a server -purely browser-side Web Crypto.
 */

import { generateFileKey } from './keys'
import { arrayBufferToBase64 } from './utils'

export interface EncryptedFile {
    ciphertext: ArrayBuffer
    iv: Uint8Array
    fileKey: CryptoKey
}

export interface EncryptedMetadata {
    ciphertext: string   // base64
    iv: string           // base64
}

/**
 * Encrypts a File using AES-256-GCM.
 *
 * A fresh file key and IV are generated per call, ensuring that
 * the same plaintext never produces the same ciphertext.
 *
 * @returns ciphertext, the 12-byte IV, and the ephemeral file key
 *          (the caller is responsible for wrapping and storing the key).
 */
export async function encryptFile(file: File): Promise<EncryptedFile> {
    const fileKey = await generateFileKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))   // 96-bit nonce for GCM

    const plaintext = await new Response(file).arrayBuffer()
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        fileKey,
        plaintext,
    )

    return { ciphertext, iv, fileKey }
}

/**
 * Encrypts an arbitrary metadata object as JSON using an existing file key.
 *
 * @param metadata  Any JSON-serialisable object (file name, size, MIME type, …)
 * @param fileKey   The AES-256-GCM key previously returned by encryptFile
 * @returns         base64-encoded ciphertext and IV
 */
export async function encryptMetadata(
    metadata: object,
    fileKey: CryptoKey,
): Promise<EncryptedMetadata> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(JSON.stringify(metadata))

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        fileKey,
        encoded,
    )

    return {
        ciphertext: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv.buffer),
    }
}
