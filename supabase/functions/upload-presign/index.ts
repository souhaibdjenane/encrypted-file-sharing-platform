/**
 * upload-presign — POST /functions/v1/upload-presign
 *
 * Validates the upload intent and returns a signed Storage upload URL
 * along with the generated storage path.
 *
 * Rate limit: 10 requests per minute per user.
 * Max file size: 500 MB.
 *
 * Request body:
 *   { fileName: string, contentType: string, fileSize: number }
 *
 * Response:
 *   { signedUrl: string, storagePath: string }
 */

import { z } from 'npm:zod@3'
import { handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { AppError, errorResponse, jsonResponse } from '../_shared/errors.ts'
import { logger } from '../_shared/logger.ts'

const MAX_FILE_SIZE = 500 * 1024 * 1024  // 500 MB

const UploadPresignSchema = z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.string().min(1).max(127),
    fileSize: z.number().int().min(1).max(MAX_FILE_SIZE, {
        message: 'File size exceeds 500 MB limit',
    }),
})

const STORAGE_BUCKET = 'encrypted-files'

Deno.serve(async (req: Request) => {
    const preflight = handleCors(req)
    if (preflight) return preflight

    try {
        // 1. Authenticate
        const { user, adminSupabase } = await verifyAuth(req)

        // 2. Rate limit: 10 per minute
        await rateLimit(`upload:${user.id}`, 10, 60)

        // 3. Parse + validate body
        let body: unknown
        try {
            body = await req.json()
        } catch {
            throw new AppError(400, 'Request body must be valid JSON', 'INVALID_JSON')
        }

        const parsed = UploadPresignSchema.safeParse(body)
        if (!parsed.success) {
            throw new AppError(
                400,
                parsed.error.errors.map((e) => e.message).join('; '),
                'VALIDATION_ERROR',
            )
        }

        const { fileName, contentType, fileSize } = parsed.data

        // 4. Generate storage path: {userId}/{uuid}-{sanitised filename}
        const uuid = crypto.randomUUID()
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${user.id}/${uuid}-${safeName}`

        // 5. Create signed upload URL (valid for 15 minutes)
        console.log(`[upload-presign] Creating signed upload URL for path: ${storagePath}`)
        const { data, error } = await adminSupabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUploadUrl(storagePath)

        if (error || !data) {
            console.error('[upload-presign] STORAGE_ERROR:', {
                message: error?.message,
                userId: user.id,
                storagePath,
                bucket: STORAGE_BUCKET
            })
            throw new AppError(500, `Storage error: ${error?.message || 'Could not generate upload URL'}`, 'STORAGE_ERROR')
        }

        logger.info('Presigned upload URL generated', {
            userId: user.id,
            storagePath,
            fileSize,
            contentType,
        })

        return jsonResponse({ signedUrl: data.signedUrl, storagePath })
    } catch (err) {
        return errorResponse(err)
    }
})
