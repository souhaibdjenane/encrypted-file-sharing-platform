/**
 * useFiles – React Query hook that fetches the user's file list and
 * decrypts each file's metadata client-side using their RSA private key.
 *
 * Returns typed DecryptedFile objects with the real filename, size and mime.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../api/supabaseClient'
import { useCrypto } from '../contexts/CryptoContext'
import { useAuthStore } from '../store/authStore'
import { unwrapFileKey } from '../crypto/keyWrap'
import { decryptMetadata } from '../crypto/decrypt'

export interface DecryptedFile {
    id: string
    owner_id: string
    storage_path: string
    name: string
    size: number
    mimeType: string
    created_at: string
    expires_at: string | null
    ivBase64: string
    wrappedKeyBase64: string
}

async function fetchAndDecryptFiles(
    userId: string,
    privateKey: CryptoKey,
): Promise<DecryptedFile[]> {
    const { data, error } = await supabase
        .from('files')
        .select(`
      id,
      owner_id,
      storage_path,
      created_at,
      expires_at,
      iv,
      encrypted_metadata,
      file_keys!inner(wrapped_key)
    `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    if (!data) return []

    const results: DecryptedFile[] = []

    for (const row of data) {
        try {
            const wrappedKeyBase64: string = Array.isArray(row.file_keys)
                ? row.file_keys[0].wrapped_key
                : (row.file_keys as { wrapped_key: string }).wrapped_key

            // Unwrap the AES file key
            const fileKey = await unwrapFileKey(wrappedKeyBase64, privateKey)

            // Decrypt file metadata
            const meta = row.encrypted_metadata as { ciphertext: string; iv: string }
            const decrypted = await decryptMetadata(meta.ciphertext, meta.iv, fileKey) as {
                name?: string; size?: number; type?: string
            }

            results.push({
                id: row.id,
                owner_id: row.owner_id,
                storage_path: row.storage_path,
                name: decrypted.name ?? 'Unnamed file',
                size: decrypted.size ?? 0,
                mimeType: decrypted.type ?? 'application/octet-stream',
                created_at: row.created_at,
                expires_at: row.expires_at ?? null,
                ivBase64: row.iv,
                wrappedKeyBase64,
            })
        } catch {
            // If one file fails to decrypt, show a placeholder rather than crashing the whole list
            results.push({
                id: row.id,
                owner_id: row.owner_id,
                storage_path: row.storage_path,
                name: '(Decryption failed)',
                size: 0,
                mimeType: 'unknown',
                created_at: row.created_at,
                expires_at: null,
                ivBase64: row.iv ?? '',
                wrappedKeyBase64: '',
            })
        }
    }

    return results
}

export function useFiles() {
    const { user } = useAuthStore()
    const { keyPair, keysReady } = useCrypto()

    return useQuery({
        queryKey: ['files', user?.id],
        queryFn: () => fetchAndDecryptFiles(user!.id, keyPair!.privateKey),
        enabled: !!user?.id && keysReady && !!keyPair,
        staleTime: 30_000,
    })
}
