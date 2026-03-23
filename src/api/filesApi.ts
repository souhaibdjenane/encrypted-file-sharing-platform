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
 * Uses raw fetch() instead of supabase.functions.invoke() to have full
 * control over the headers. The SDK's invoke() always injects an
 * `apikey: <anonKey>` header from client initialization — if that key is
 * wrong, Supabase's API gateway returns 401 BEFORE the request reaches
 * the Edge Function. With fetch() we send only what the Edge Function needs.
 */
async function invokeEdgeFunction<T>(functionName: string, body: unknown): Promise<T> {
    // Get the current session so we can attach the user's JWT
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token

    if (!accessToken) {
        throw new Error('You must be logged in in to perform this action. Please sign in and try again.')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
    const url = `${supabaseUrl}/functions/v1/${functionName}`

    // --- DEBUG CHECK: Detect invalid 'xxx' key ---
    if (supabasePublishableKey.includes('xxx')) {
        console.error(' [CRITICAL] Your VITE_SUPABASE_PUBLISHABLE_KEY in .env.local contains "xxx". This key is invalid!')
        console.warn(' Please copy the REAL key from Supabase Dashboard -> Settings -> API.')
    }
    // --------------------------------------------

    console.debug(`[filesApi] POST ${url}`)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Supabase gateway requires apikey to route the request
            'apikey': supabasePublishableKey,
            // Edge Function verifyAuth() validates this user JWT
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    })

    const text = await response.text()
    console.debug(`[filesApi] ${functionName} → HTTP ${response.status}:`, text)

    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`
        try {
            const parsed = JSON.parse(text)
            errorMsg = parsed.error ?? parsed.message ?? errorMsg
        } catch {
            errorMsg = text || errorMsg
        }

        if (response.status === 401 && errorMsg.includes('Invalid JWT')) {
            console.error(' [AUTH ERROR 401] Your key or session is rejected by Supabase.')
            console.warn(' This usually means either:')
            console.warn(' 1. The VITE_SUPABASE_PUBLISHABLE_KEY in .env.local is wrong (current key length:', supabasePublishableKey.length, ')')
            console.warn(' 2. You are still logged in with a session from an OLD key. Try logging out and back in.')
        }

        throw new Error(`${errorMsg} (HTTP ${response.status})`)
    }

    try {
        return JSON.parse(text) as T
    } catch {
        throw new Error(`Invalid JSON response from ${functionName}`)
    }
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
