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
 */
async function invokeEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
        body: body as any,
    })

    if (error) {
        // Attempt to extract the JSON error message from the Edge Function
        let errorMsg = error.message;
        if (error.context && error.context.status) {
            try {
                const contextStr = await error.context.text();
                if (contextStr) {
                    const parsed = JSON.parse(contextStr);
                    if (parsed.error) {
                        errorMsg = parsed.error;
                    }
                }
            } catch {
                // Ignore parse errors, fallback to default message
            }
        }
        throw new Error(errorMsg || `Error invoking ${functionName}`)
    }

    if (!data) {
        throw new Error(`No data returned from ${functionName}`);
    }

    return data
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
        // We need to insert into `files` first, then `file_keys`.
        // Since we are client-side, we must do this sequentially to respect FK constraints
        // OR use an RPC function. For simplicity, we'll do sequential here.

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
            // Cleanup the file record if key insertion fails (client-side transaction simulation)
            await supabase.from('files').delete().eq('id', fileRecord.id);
            throw new Error(`Failed to insert wrapped key: ${keyError.message}`)
        }
    }
}
