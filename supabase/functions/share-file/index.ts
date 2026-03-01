/**
 * share-file — POST /functions/v1/share-file
 *
 * Creates a share record and returns the recipient's public key so
 * the client can wrap the AES file key server-side before uploading
 * to file_keys.
 *
 * Rate limit: 20 requests per 5 minutes per user.
 *
 * Request body:
 *   {
 *     fileId: string,
 *     recipientEmail: string,
 *     canDownload?: boolean,       // default true
 *     canReshare?: boolean,        // default false
 *     expiresAt?: string           // ISO-8601 or null
 *   }
 *
 * Response:
 *   {
 *     shareId: string,
 *     token: string,
 *     recipientId: string,
 *     recipientPublicKey: string   // base64 SPKI — use to wrap file key
 *   }
 */

import { z } from 'npm:zod@3'
import { handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts'
import { logger } from '../_shared/logger.ts'

const ShareFileSchema = z.object({
    fileId: z.string().uuid('fileId must be a valid UUID'),
    recipientEmail: z.string().email('recipientEmail must be a valid email'),
    canDownload: z.boolean().default(true),
    canReshare: z.boolean().default(false),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
})

Deno.serve(async (req: Request) => {
    const preflight = handleCors(req)
    if (preflight) return preflight

    try {
        // 1. Authenticate
        const { user, supabase, adminSupabase } = await verifyAuth(req)

        // 2. Rate limit: 20 per 5 minutes
        await rateLimit(`share:${user.id}`, 20, 300)

        // 3. Parse + validate body
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw new AppError(400, 'Request body must be valid JSON', 'INVALID_JSON')
        }

        const parsed = ShareFileSchema.safeParse(body)
        if (!parsed.success) {
            throw new AppError(
                400,
                parsed.error.errors.map((e) => e.message).join('; '),
                'VALIDATION_ERROR',
            )
        }

        const { fileId, recipientEmail, canDownload, canReshare, expiresAt } = parsed.data

        // 4. Verify the caller owns the file
        const { data: file, error: fileError } = await supabase
            .from('files')
            .select('id, owner_id')
            .eq('id', fileId)
            .maybeSingle()

        if (fileError) throw new AppError(500, 'Database error', 'DB_ERROR')
        if (!file) throw new AppError(404, 'File not found', 'NOT_FOUND')
        if (file.owner_id !== user.id) {
            throw new AppError(403, 'Only the file owner can create shares', 'FORBIDDEN')
        }

        // 5. Look up recipient user by email via admin client (bypasses RLS on auth.users)
        const { data: { users }, error: lookupError } = await adminSupabase.auth.admin.listUsers()
        if (lookupError) throw new AppError(500, 'Failed to look up recipient', 'DB_ERROR')

        const recipient = users.find(
            (u) => u.email?.toLowerCase() === recipientEmail.toLowerCase(),
        )
        if (!recipient) {
            throw new AppError(404, 'Recipient not found. They must register first.', 'RECIPIENT_NOT_FOUND')
        }

        // 6. Extract recipient's public key from user_metadata
        const recipientPublicKey: string | undefined =
            recipient.user_metadata?.public_key

        if (!recipientPublicKey) {
            throw new AppError(
                422,
                'Recipient has not initialised their encryption keys yet.',
                'NO_PUBLIC_KEY',
            )
        }

        // 7. Prevent sharing with yourself
        if (recipient.id === user.id) {
            throw new AppError(400, 'Cannot share a file with yourself', 'SELF_SHARE')
        }

        // 8. Insert share record
        const { data: share, error: shareError } = await adminSupabase
            .from('shares')
            .insert({
                file_id: fileId,
                shared_by: user.id,
                shared_with: recipient.id,
                can_download: canDownload,
                can_reshare: canReshare,
                expires_at: expiresAt ?? null,
            })
            .select('id, token')
            .single()

        if (shareError || !share) {
            logger.error('Failed to insert share record', { error: shareError?.message })
            throw new AppError(500, 'Failed to create share', 'DB_ERROR')
        }

        // 9. Audit log
        await adminSupabase.from('audit_logs').insert({
            user_id: user.id,
            file_id: fileId,
            action: 'share',
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
            user_agent: req.headers.get('user-agent') ?? null,
            metadata: {
                share_id: share.id,
                shared_with: recipient.id,
                can_download: canDownload,
                can_reshare: canReshare,
            },
        })

        logger.info('File shared', {
            fileId,
            sharedBy: user.id,
            sharedWith: recipient.id,
            shareId: share.id,
        })

        return jsonResponse({
            shareId: share.id,
            token: share.token,
            recipientId: recipient.id,
            recipientPublicKey,
        })
    } catch (err) {
        return errorResponse(err)
    }
})
