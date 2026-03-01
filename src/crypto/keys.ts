/**
 * Key generation and import/export helpers.
 * All operations use window.crypto.subtle - zero server involvement.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from './utils'

/**
 * Generates an RSA-OAEP 4096-bit key pair.
 * Extractable - so we can store the private key in IndexedDB
 * and export the public key as SPKI to upload to Supabase.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,                          // extractable
        ['wrapKey', 'unwrapKey'],
    )
}

/**
 * Generates an AES-256-GCM symmetric key for file encryption.
 * Extractable - so it can be wrapped with RSA before upload.
 */
export async function generateFileKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,                          // extractable
        ['encrypt', 'decrypt'],
    )
}

/**
 * Exports a CryptoKey (public) to a base64-encoded SPKI string
 * suitable for storage in Supabase user_metadata.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey('spki', key)
    return arrayBufferToBase64(spki)
}

/**
 * Imports a base64-encoded SPKI string back into a CryptoKey
 * (non-extractable public key for wrapKey operations only).
 */
export async function importPublicKey(base64: string): Promise<CryptoKey> {
    const spki = base64ToArrayBuffer(base64)
    return crypto.subtle.importKey(
        'spki',
        spki,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,                         // non-extractable is fine for public key
        ['wrapKey'],
    )
}
