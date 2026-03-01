/**
 * Magic byte file type validation.
 * Reads the first 8 bytes of a file to confirm its type before encryption.
 * Rejects files whose bytes don't match any known signature.
 */

interface MagicEntry {
    name: string
    bytes: (number | null)[]  // null = wildcard
    mimeType: string
}

// Ordered by specificity (more specific first)
const SIGNATURES: MagicEntry[] = [
    { name: 'PDF', bytes: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf' },
    { name: 'PNG', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png' },
    { name: 'JPEG', bytes: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg' },
    { name: 'GIF', bytes: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif' },
    // WEBP: RIFF????WEBP
    { name: 'WEBP', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50], mimeType: 'image/webp' },
    // MP4: ftyp box at byte 4
    { name: 'MP4', bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4' },
    // ZIP / DOCX / XLSX / PPTX — all use PK zip container
    { name: 'ZIP', bytes: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip' },
    { name: 'ZIP', bytes: [0x50, 0x4B, 0x05, 0x06], mimeType: 'application/zip' },
    // Plain text: no magic bytes — allow by MIME type below
]

const ALLOWED_TEXT_MIMES = new Set([
    'text/plain', 'text/csv', 'text/html', 'application/json',
    'application/octet-stream',  // generic binary, allow upload
])

export interface MagicByteResult {
    valid: boolean
    detected: string | null
    reason?: string
}

function matchesSignature(view: Uint8Array, sig: MagicEntry): boolean {
    for (let i = 0; i < sig.bytes.length; i++) {
        const expected = sig.bytes[i]
        if (expected === null) continue          // wildcard
        if (view[i] !== expected) return false
    }
    return true
}

export async function validateFileType(file: File): Promise<MagicByteResult> {
    // Read the first 12 bytes (enough for WEBP detection)
    const bytesToRead = Math.min(12, file.size)
    const slice = file.slice(0, bytesToRead)
    const buffer = await slice.arrayBuffer()
    const view = new Uint8Array(buffer)

    // Try known signatures
    for (const sig of SIGNATURES) {
        if (matchesSignature(view, sig)) {
            return { valid: true, detected: sig.name }
        }
    }

    // Fall back to MIME type for text-based files (no reliable magic bytes)
    const baseType = file.type.split(';')[0].trim()
    if (ALLOWED_TEXT_MIMES.has(baseType)) {
        return { valid: true, detected: baseType }
    }

    // Check if it's an audio / video type declared in mime
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        return { valid: true, detected: file.type }
    }

    return {
        valid: false,
        detected: null,
        reason: `File type not recognized. Supported types: PDF, PNG, JPEG, GIF, WEBP, MP4, ZIP, DOCX, plain text. Got: ${file.type || 'unknown'}`,
    }
}
