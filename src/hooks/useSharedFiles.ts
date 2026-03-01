/**
 * useSharedFiles — React Query hook that fetches files shared WITH the
 * current user and decrypts their metadata client-side.
 *
 * Query key: ['sharedFiles', userId]
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../api/supabaseClient'
import { useCrypto } from '../contexts/CryptoContext'
import { useAuthStore } from '../store/authStore'
import { unwrapFileKey } from '../crypto/keyWrap'
import { decryptMetadata } from '../crypto/decrypt'

export interface SharedFile {
    id: string
    shareId: string
    sharedBy: string
    file_id: string
    storage_path: string
    name: string
    size: number
    mimeType: string
    created_at: string
    expires_at: string | null
    ivBase64: string
    wrappedKeyBase64: string
    canDownload: boolean
}

async function fetchSharedFiles(userId: string, privateKey: CryptoKey): Promise<SharedFile[]> {
    // Fetch shares joined with files
    const { data, error } = await supabase
        .from('shares')
        .select(`
      id,
      shared_by,
      can_download,
      expires_at,
      files!inner(
        id,
        storage_path,
        encrypted_metadata,
        iv,
        created_at,
        expires_at
      )
    `)
        .eq('shared_with', userId)
        .eq('revoked', false)
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    if (!data) return []

    const results: SharedFile[] = []

    for (const row of data) {
        try {
            const file = Array.isArray(row.files) ? row.files[0] : row.files as any

            // Get the user's wrapped key for this file
            const { data: keyRow } = await supabase
                .from('file_keys')
                .select('wrapped_key')
                .eq('file_id', file.id)
                .eq('user_id', userId)
                .maybeSingle()

            if (!keyRow) continue  // No key for this file, skip

            const fileKey = await unwrapFileKey(keyRow.wrapped_key, privateKey)
            const meta = file.encrypted_metadata as { ciphertext: string; iv: string }
            const decrypted = await decryptMetadata(meta.ciphertext, meta.iv, fileKey) as {
                name?: string; size?: number; type?: string
            }

            results.push({
                id: file.id,
                shareId: row.id,
                sharedBy: row.shared_by,
                file_id: file.id,
                storage_path: file.storage_path,
                name: decrypted.name ?? 'Unnamed file',
                size: decrypted.size ?? 0,
                mimeType: decrypted.type ?? 'application/octet-stream',
                created_at: file.created_at,
                expires_at: row.expires_at ?? null,
                ivBase64: file.iv,
                wrappedKeyBase64: keyRow.wrapped_key,
                canDownload: row.can_download,
            })
        } catch {
            // Skip files that fail to decrypt
        }
    }

    return results
}

export function useSharedFiles() {
    const { user } = useAuthStore()
    const { keyPair, keysReady } = useCrypto()

    return useQuery({
        queryKey: ['sharedFiles', user?.id],
        queryFn: () => fetchSharedFiles(user!.id, keyPair!.privateKey),
        enabled: !!user?.id && keysReady && !!keyPair,
        staleTime: 30_000,
    })
}
