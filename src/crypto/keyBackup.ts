/**
 * PBKDF2-based key backup and restore.
 *
 * Backup format (JSON):
 *   { version: 1, salt: base64, iv: base64, ciphertext: base64 }
 *
 * Security parameters:
 *   - PBKDF2: SHA-256, 600,000 iterations
 *   - Wrapping cipher: AES-GCM-256
 */
import { arrayBufferToBase64, base64ToArrayBuffer } from './utils'

const PBKDF2_ITERATIONS = 600_000
const BACKUP_VERSION = 1

export interface KeyBackup {
    version: number
    salt: string   // base64
    iv: string   // base64
    ciphertext: string   // base64 (AES-GCM encrypted PKCS8 private key)
}

// Helper: generate random bytes as a plain ArrayBuffer (avoids SharedArrayBuffer TS issue)
function randomBuffer(bytes: number): ArrayBuffer {
    const arr = new Uint8Array(bytes)
    crypto.getRandomValues(arr)
    return arr.buffer.slice(0) as ArrayBuffer
}

// Derive a wrapping key from password + salt (ArrayBuffer)
async function deriveWrappingKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
    )

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['wrapKey', 'unwrapKey'],
    )
}

/**
 * Exports the private key as an encrypted backup JSON and triggers browser download.
 */
export async function exportKeyBackup(privateKey: CryptoKey, password: string): Promise<void> {
    const salt = randomBuffer(32)
    const iv = randomBuffer(12)

    const wrappingKey = await deriveWrappingKey(password, salt)

    const wrappedKey = await crypto.subtle.wrapKey(
        'pkcs8',
        privateKey,
        wrappingKey,
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
    )

    const backup: KeyBackup = {
        version: BACKUP_VERSION,
        salt: arrayBufferToBase64(salt),
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(wrappedKey),
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vaultshare-key-backup.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Restores a private key from a backup JSON string and password.
 * Throws on wrong password or corrupted backup.
 */
export async function restoreKeyBackup(backupJson: string, password: string): Promise<CryptoKey> {
    let backup: KeyBackup
    try {
        backup = JSON.parse(backupJson) as KeyBackup
    } catch {
        throw new Error('Invalid backup file format.')
    }

    if (backup.version !== BACKUP_VERSION) {
        throw new Error(`Unsupported backup version: ${backup.version}`)
    }

    const salt = base64ToArrayBuffer(backup.salt)
    const iv = base64ToArrayBuffer(backup.iv)
    const ciphertext = base64ToArrayBuffer(backup.ciphertext)

    const wrappingKey = await deriveWrappingKey(password, salt)

    try {
        return await crypto.subtle.unwrapKey(
            'pkcs8',
            ciphertext,
            wrappingKey,
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['unwrapKey'],
        )
    } catch {
        throw new Error('Incorrect password or corrupted backup file.')
    }
}

/**
 * Returns a short fingerprint: first 8 hex bytes of SHA-256 of the SPKI public key.
 */
export async function getPublicKeyFingerprint(publicKey: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey('spki', publicKey)
    const digest = await crypto.subtle.digest('SHA-256', spki)
    const bytes = Array.from(new Uint8Array(digest).slice(0, 8))
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':')
}
