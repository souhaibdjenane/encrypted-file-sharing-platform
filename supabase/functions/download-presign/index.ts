/**
 * download-presign — POST /functions/v1/download-presign
 *
 * Dual authentication:
 *   A) JWT auth (normal signed-in user): validated via verifyAuth()
 *   B) Share token auth (public link):   { token: string } in body, no JWT required
 *
 * Returns a 1-hour signed download URL from Supabase Storage.
 *
 * Request body:
 *   Authenticated:  { fileId: string }
 *   Token-based:    { token: string }
 *
 * Response:
 *   { signedUrl: string, expiresAt: string }
 */

import { z } from 'npm:zod@3'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts'
import { logger } from '../_shared/logger.ts'

const AuthedSchema = z.object({
    fileId: z.string().uuid('fileId must be a valid UUID'),
})

const TokenSchema = z.object({
    token: z.string().min(1, 'token is required'),
})

const STORAGE_BUCKET = 'encrypted-files'
const SIGNED_URL_EXPIRY_SECS = 3600   // 1 hour

Deno.serve(async (req: Request) => {
    const preflight = handleCors(req)
    if (preflight) return preflight

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return errorResponse(new AppError(400, 'Request body must be valid JSON', 'INVALID_JSON'))
    }

    // ── Path A: Token-based (public link) ─────────────────────────────────────
    const tokenParsed = TokenSchema.safeParse(body)
    if (tokenParsed.success) {
        return handleTokenDownload(req, tokenParsed.data.token)
    }

    // ── Path B: JWT-authenticated download ────────────────────────────────────
    try {
        const { user, supabase, adminSupabase } = await verifyAuth(req)
        await rateLimit(`download:${user.id}`, 50, 60)

        const parsed = AuthedSchema.safeParse(body)
        if (!parsed.success) {
            throw new AppError(400, parsed.error.errors[0].message, 'VALIDATION_ERROR')
        }
        const { fileId } = parsed.data

        // Fetch file (RLS allows owner + shared users)
        const { data: file, error: fileError } = await supabase
            .from('files')
            .select('id, owner_id, storage_path, download_limit, download_count')
            .eq('id', fileId)
            .maybeSingle()

        if (fileError) throw new AppError(500, 'Database error during file lookup', 'DB_ERROR')
        if (!file) throw new AppError(404, 'File not found or access denied', 'NOT_FOUND')

        if (file.download_limit !== null && file.download_count >= file.download_limit) {
            throw new AppError(403, 'Download limit reached for this file', 'DOWNLOAD_LIMIT_REACHED')
        }

        // Increment download count
        await adminSupabase.from('files')
            .update({ download_count: file.download_count + 1 })
            .eq('id', fileId)

        // Generate signed URL
        const { data: urlData, error: urlError } = await adminSupabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.storage_path, SIGNED_URL_EXPIRY_SECS)

        if (urlError || !urlData) {
            throw new AppError(500, 'Could not generate download URL', 'STORAGE_ERROR')
        }

        // Audit log
        await adminSupabase.from('audit_logs').insert({
            user_id: user.id,
            file_id: fileId,
            action: 'download',
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
            user_agent: req.headers.get('user-agent') ?? null,
            metadata: { download_count: file.download_count + 1 },
        })

        logger.info('Authed download URL issued', { userId: user.id, fileId })

        const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECS * 1000).toISOString()
        return jsonResponse({ signedUrl: urlData.signedUrl, expiresAt })
    } catch (err) {
        return errorResponse(err)
    }
})

// ── Token download handler ─────────────────────────────────────────────────────
async function handleTokenDownload(req: Request, token: string): Promise<Response> {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const adminClient = createClient(supabaseUrl, serviceKey)

        // 1. Validate share token
        const { data: share, error: shareError } = await adminClient
            .from('shares')
            .select('id, file_id, can_download, revoked, expires_at')
            .eq('token', token)
            .maybeSingle()

        if (shareError) throw new AppError(500, 'Database error', 'DB_ERROR')
        if (!share) throw new AppError(404, 'Share link not found', 'NOT_FOUND')
        if (share.revoked) throw new AppError(403, 'This link has been revoked', 'REVOKED')
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            throw new AppError(403, 'This link has expired', 'EXPIRED')
        }
        if (!share.can_download) {
            throw new AppError(403, 'This link does not allow downloads', 'NOT_ALLOWED')
        }

        // 2. Fetch file record
        const { data: file, error: fileError } = await adminClient
            .from('files')
            .select('id, storage_path, download_limit, download_count')
            .eq('id', share.file_id)
            .maybeSingle()

        if (fileError || !file) throw new AppError(404, 'File not found', 'NOT_FOUND')

        if (file.download_limit !== null && file.download_count >= file.download_limit) {
            throw new AppError(403, 'Download limit reached for this file', 'DOWNLOAD_LIMIT_REACHED')
        }

        // 3. Increment download count
        await adminClient.from('files')
            .update({ download_count: file.download_count + 1 })
            .eq('id', file.id)

        // 4. Generate signed URL using admin client (bypasses storage RLS)
        const { data: urlData, error: urlError } = await adminClient.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(file.storage_path, SIGNED_URL_EXPIRY_SECS)

        if (urlError || !urlData) {
            throw new AppError(500, 'Could not generate download URL', 'STORAGE_ERROR')
        }

        // 5. Audit log (no user_id for anonymous token access)
        await adminClient.from('audit_logs').insert({
            user_id: null,
            file_id: file.id,
            action: 'download_public',
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
            user_agent: req.headers.get('user-agent') ?? null,
            metadata: { share_id: share.id, token_used: true },
        })

        logger.info('Public download URL issued', { shareId: share.id, fileId: file.id })

        const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECS * 1000).toISOString()
        return jsonResponse({ signedUrl: urlData.signedUrl, expiresAt })
    } catch (err) {
        return errorResponse(err)
    }
}
