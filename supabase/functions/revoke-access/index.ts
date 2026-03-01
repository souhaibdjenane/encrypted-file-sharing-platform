/**
 * revoke-access — POST /functions/v1/revoke-access
 *
 * Sets revoked=true on a share record. Only the file owner can call this.
 *
 * Rate limit: 30 requests per minute per user.
 *
 * Request body:
 *   { shareId: string }
 *
 * Response:
 *   { revoked: true, shareId: string }
 */

import { z } from 'npm:zod@3'
import { handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts'
import { logger } from '../_shared/logger.ts'

const RevokeAccessSchema = z.object({
    shareId: z.string().uuid('shareId must be a valid UUID'),
})

Deno.serve(async (req: Request) => {
    const preflight = handleCors(req)
    if (preflight) return preflight

    try {
        // 1. Authenticate
        const { user, supabase, adminSupabase } = await verifyAuth(req)

        // 2. Rate limit: 30 per minute
        await rateLimit(`revoke:${user.id}`, 30, 60)

        // 3. Parse + validate body
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw new AppError(400, 'Request body must be valid JSON', 'INVALID_JSON')
        }

        const parsed = RevokeAccessSchema.safeParse(body)
        if (!parsed.success) {
            throw new AppError(400, parsed.error.errors[0].message, 'VALIDATION_ERROR')
        }

        const { shareId } = parsed.data

        // 4. Fetch share + file ownership in one query
        //    RLS on shares lets owners read their shares
        const { data: share, error: shareError } = await supabase
            .from('shares')
            .select('id, file_id, shared_by, shared_with, revoked, files!inner(owner_id)')
            .eq('id', shareId)
            .maybeSingle()

        if (shareError) {
            logger.error('Share lookup error', { userId: user.id, shareId, error: shareError.message })
            throw new AppError(500, 'Database error', 'DB_ERROR')
        }
        if (!share) {
            throw new AppError(404, 'Share not found', 'NOT_FOUND')
        }

        // 5. Authorisation: only the file owner can revoke
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fileOwnerId = (share as any).files?.owner_id
        if (fileOwnerId !== user.id) {
            throw new AppError(403, 'Only the file owner can revoke access', 'FORBIDDEN')
        }

        // 6. Already revoked?
        if (share.revoked) {
            return jsonResponse({ revoked: true, shareId, alreadyRevoked: true })
        }

        // 7. Set revoked = true (admin client so update is not blocked by RLS)
        const { error: updateError } = await adminSupabase
            .from('shares')
            .update({ revoked: true })
            .eq('id', shareId)

        if (updateError) {
            logger.error('Failed to revoke share', { shareId, error: updateError.message })
            throw new AppError(500, 'Failed to revoke access', 'DB_ERROR')
        }

        // 8. Audit log
        await adminSupabase.from('audit_logs').insert({
            user_id: user.id,
            file_id: share.file_id,
            action: 'revoke',
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
            user_agent: req.headers.get('user-agent') ?? null,
            metadata: { share_id: shareId, shared_with: share.shared_with },
        })

        logger.info('Share revoked', { userId: user.id, shareId, fileId: share.file_id })

        return jsonResponse({ revoked: true, shareId })
    } catch (err) {
        return errorResponse(err)
    }
})
