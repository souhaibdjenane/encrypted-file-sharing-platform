import { supabase } from './supabaseClient'

export interface UploadPresignRequest {
    fileName: string;
    contentType: string;
    fileSize: number;
}

export interface UploadPresignResponse {
    signedUrl: string;
    storagePath: string;
}

export interface DownloadPresignRequest {
    fileId: string;
}

export interface DownloadPresignResponse {
    signedUrl: string;
    expiresAt: string;
}

export interface ShareFileRequest {
    fileId: string;
    recipientEmail: string;
    canDownload?: boolean;
    canReshare?: boolean;
    expiresAt?: string | null;
}

export interface ShareFileResponse {
    shareId: string;
    token: string;
    recipientId: string;
    recipientPublicKey: string; // Base64 SPKI
}

export interface RevokeAccessRequest {
    shareId: string;
}

export interface RevokeAccessResponse {
    revoked: boolean;
    shareId: string;
    alreadyRevoked?: boolean;
}

/**
 * Helper to standardise Edge Function calls and error throwing.
 *
 * Reverted to supabase.functions.invoke() which handles the newer
 * `sb_publishable_` keys and auth headers correctly.
 */
async function invokeEdgeFunction<T>(functionName: string, body: any): Promise<T> {
    const { data, error } = await supabase.functions.invoke(functionName, {
        body,
    })

    if (error) {
        console.error(`[filesApi] ${functionName} error:`, error)

        // Enhance 401 error messaging for the user
        const isAuthError = error.message?.includes('401') || error.message?.includes('Invalid JWT')
        if (isAuthError) {
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
            console.warn(' [AUTH ERROR 401] This usually means your .env.local key is wrong or your session is stale.')
            console.warn(` Current key length: ${anonKey.length}`)
            throw new Error(`Authentication error (401). Please log out and log back in to refresh your keys.`)
        }

        throw new Error(`${error.message || 'Unknown error'} (Edge Function)`)
    }

    return data as T
}

export const filesApi = {
    async getUploadPresignUrl(req: UploadPresignRequest): Promise<UploadPresignResponse> {
        return invokeEdgeFunction<UploadPresignResponse>('upload-presign', req)
    },

    async getDownloadPresignUrl(req: DownloadPresignRequest): Promise<DownloadPresignResponse> {
        return invokeEdgeFunction<DownloadPresignResponse>('download-presign', req)
    },

    async shareFile(req: ShareFileRequest): Promise<ShareFileResponse> {
        return invokeEdgeFunction<ShareFileResponse>('share-file', req)
    },

    async revokeAccess(req: RevokeAccessRequest): Promise<RevokeAccessResponse> {
        return invokeEdgeFunction<RevokeAccessResponse>('revoke-access', req)
    },

    // --- Database Wrappers ---

    async insertFileAndKey(
        fileRecord: {
            id: string;
            owner_id: string;
            storage_path: string;
            encrypted_metadata: { ciphertext: string; iv: string };
            file_size_bytes: number;
            mime_type: string;
            iv: string;
        },
        wrappedKey: string
    ) {
        const { error: fileError } = await supabase
            .from('files')
            .insert(fileRecord)

        if (fileError) throw new Error(`Failed to insert file metadata: ${fileError.message}`)

        const { error: keyError } = await supabase
            .from('file_keys')
            .insert({
                file_id: fileRecord.id,
                user_id: fileRecord.owner_id,
                wrapped_key: wrappedKey,
            })

        if (keyError) {
            await supabase.from('files').delete().eq('id', fileRecord.id);
            throw new Error(`Failed to insert wrapped key: ${keyError.message}`)
        }
    }
}
