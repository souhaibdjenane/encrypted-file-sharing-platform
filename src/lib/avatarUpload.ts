import { supabase } from './supabase'

/**
 * Compress an image file to a small JPEG data URL (200×200 max, 75% quality).
 * Used as a fallback when Supabase Storage bucket is not configured.
 */
function compressToDataUrl(file: File, maxPx = 200, quality = 0.75): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
            const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * ratio)
            canvas.height = Math.round(img.height * ratio)

            const ctx = canvas.getContext('2d')
            if (!ctx) { reject(new Error('canvas unavailable')); return }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            URL.revokeObjectURL(objectUrl)
            resolve(canvas.toDataURL('image/jpeg', quality))
        }

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('image load failed'))
        }

        img.src = objectUrl
    })
}

/**
 * Upload a profile avatar.
 *
 * Strategy:
 *  1. Try Supabase Storage bucket "avatars" (best for production).
 *  2. If the bucket doesn't exist or the upload fails, fall back to a
 *     compressed 200×200 JPEG data URL stored directly in user_metadata.
 *     This always works with zero Supabase Storage configuration.
 *
 * To activate Storage (optional, better for large images):
 *   Supabase Dashboard → Storage → New bucket → name: "avatars" → Public: on
 *
 * @returns Public URL (Storage) or data URL (fallback), never null on success.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
    // ── Attempt 1: Supabase Storage ───────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/avatar.${ext}`

    const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })

    if (!storageError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        // Cache-buster so the browser always fetches the new image
        return `${data.publicUrl}?t=${Date.now()}`
    }

    // ── Attempt 2: compressed data URL (always works) ─────────────
    console.info(
        '[VaultShare] Storage unavailable (%s) — falling back to compressed data URL.',
        storageError.message,
    )
    try {
        return await compressToDataUrl(file)
    } catch (e) {
        console.error('[VaultShare] compressToDataUrl failed:', e)
        return null
    }
}

/**
 * Persist display_name and/or avatar_url to Supabase user_metadata.
 */
export async function updateProfile(opts: {
    displayName?: string
    avatarUrl?: string
}): Promise<{ error: string | null }> {
    const data: Record<string, string> = {}
    if (opts.displayName !== undefined) data.display_name = opts.displayName
    if (opts.avatarUrl !== undefined) data.avatar_url = opts.avatarUrl

    const { error } = await supabase.auth.updateUser({ data })
    return { error: error?.message ?? null }
}
