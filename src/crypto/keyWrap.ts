/**
 * Key-wrapping helpers.
 *
 * The AES file key is wrapped (encrypted) with the recipient's RSA public key
 * so only they can unwrap (decrypt) it with their private key.
 * This implements the hybrid encryption envelope pattern.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from './utils'

/**
 * Wraps an AES-256-GCM file key with a recipient's RSA-OAEP public key.
 *
 * @param fileKey             The ephemeral AES-GCM key to protect
 * @param recipientPublicKey  The recipient's RSA-OAEP public CryptoKey
 * @returns                   base64-encoded wrapped key blob
 */
export async function wrapFileKey(
    fileKey: CryptoKey,
    recipientPublicKey: CryptoKey,
): Promise<string> {
    const wrapped = await crypto.subtle.wrapKey(
        'raw',               // export format for the AES key
        fileKey,
        recipientPublicKey,
        { name: 'RSA-OAEP' },
    )
    return arrayBufferToBase64(wrapped)
}

/**
 * Unwraps a base64-encoded wrapped key blob using the holder's RSA private key,
 * producing a usable AES-256-GCM CryptoKey.
 *
 * @param wrappedKeyBase64  The base64 blob returned by wrapFileKey()
 * @param privateKey        The recipient's RSA-OAEP private CryptoKey
 * @returns                 The unwrapped AES-GCM key, ready for decryption
 */
export async function unwrapFileKey(
    wrappedKeyBase64: string,
    privateKey: CryptoKey,
): Promise<CryptoKey> {
    const wrappedBuffer = base64ToArrayBuffer(wrappedKeyBase64)

    return crypto.subtle.unwrapKey(
        'raw',                              // the format it was wrapped from
        wrappedBuffer,
        privateKey,
        { name: 'RSA-OAEP' },              // the wrapping algorithm
        { name: 'AES-GCM', length: 256 },  // the target key algorithm
        true,                               // extractable
        ['encrypt', 'decrypt'],
    )
}
