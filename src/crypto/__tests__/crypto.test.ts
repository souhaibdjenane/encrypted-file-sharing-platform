/**
 * Vitest roundtrip tests for the crypto layer.
 *
 * These run entirely in the Node.js environment — no browser needed.
 * Node 19+ exposes globalThis.crypto (Web Crypto API) natively.
 */

import { describe, it, expect } from 'vitest'
import { generateKeyPair, generateFileKey } from '../keys'
import { encryptFile, encryptMetadata } from '../encrypt'
import { decryptFile, decryptMetadata } from '../decrypt'
import { wrapFileKey, unwrapFileKey } from '../keyWrap'

// ---------------------------------------------------------------------------
// 1. encryptFile → decryptFile roundtrip
// ---------------------------------------------------------------------------
describe('encryptFile / decryptFile', () => {
    it('decrypts to the original file bytes', async () => {
        const content = 'Hello, VaultShare! 🔐'
        const file = new File([content], 'test.txt', { type: 'text/plain' })

        const { ciphertext, iv, fileKey } = await encryptFile(file)

        // Ciphertext must differ from plaintext
        const plainBytes = new TextEncoder().encode(content)
        const cipherBytes = new Uint8Array(ciphertext)
        expect(cipherBytes.length).toBeGreaterThan(plainBytes.length - 1)

        const decrypted = await decryptFile(ciphertext, iv, fileKey)
        const decoded = new TextDecoder().decode(decrypted)
        expect(decoded).toBe(content)
    })

    it('produces different ciphertext on every call (fresh IV)', async () => {
        const file = new File(['same content'], 'a.txt', { type: 'text/plain' })
        const r1 = await encryptFile(file)
        const r2 = await encryptFile(file)

        // IVs must be different
        const toHex = (u8: Uint8Array) =>
            Array.from(u8).map((b) => b.toString(16).padStart(2, '0')).join('')
        expect(toHex(r1.iv)).not.toBe(toHex(r2.iv))
    })
})

// ---------------------------------------------------------------------------
// 2. encryptMetadata → decryptMetadata roundtrip
// ---------------------------------------------------------------------------
describe('encryptMetadata / decryptMetadata', () => {
    it('decrypts to the original metadata object', async () => {
        const fileKey = await generateFileKey()
        const meta = { name: 'secret.pdf', size: 42_000, mimeType: 'application/pdf' }

        const { ciphertext, iv } = await encryptMetadata(meta, fileKey)

        // Values must be base64 strings, not the raw object
        expect(typeof ciphertext).toBe('string')
        expect(typeof iv).toBe('string')

        const result = await decryptMetadata(ciphertext, iv, fileKey) as typeof meta
        expect(result.name).toBe(meta.name)
        expect(result.size).toBe(meta.size)
        expect(result.mimeType).toBe(meta.mimeType)
    })
})

// ---------------------------------------------------------------------------
// 3. wrapFileKey → unwrapFileKey roundtrip
// ---------------------------------------------------------------------------
describe('wrapFileKey / unwrapFileKey', () => {
    it('unwrapped key can decrypt data encrypted with the original key', async () => {
        const { publicKey, privateKey } = await generateKeyPair()
        const fileKey = await generateFileKey()

        // Wrap with recipient's public key
        const wrappedBase64 = await wrapFileKey(fileKey, publicKey)
        expect(typeof wrappedBase64).toBe('string')
        expect(wrappedBase64.length).toBeGreaterThan(0)

        // Unwrap with recipient's private key
        const unwrappedKey = await unwrapFileKey(wrappedBase64, privateKey)

        // Verify the unwrapped key can actually decrypt something the original encrypted
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const plaintext = new TextEncoder().encode('roundtrip test')

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            fileKey,
            plaintext,
        )

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            unwrappedKey,
            ciphertext,
        )

        expect(new TextDecoder().decode(decrypted)).toBe('roundtrip test')
    })
})
