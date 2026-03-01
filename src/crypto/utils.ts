/**
 * Crypto utility helpers - pure, no state, no side-effects.
 */

export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
    const bytes = new Uint8Array(buffer as ArrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

export function bufferToHex(buffer: ArrayBufferLike): string {
    return Array.from(new Uint8Array(buffer as ArrayBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}
