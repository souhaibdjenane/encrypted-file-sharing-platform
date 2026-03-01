/**
 * Rate limiting via Upstash Redis REST API.
 *
 * Uses a sliding window counter (INCR + EXPIRE) stored in Redis.
 * If the Redis env vars are not set, rate limiting is skipped gracefully
 * so functions still work during local development without Upstash.
 *
 * Required env vars:
 *   UPSTASH_REDIS_REST_URL   — e.g. https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — your Upstash REST token
 */

import { AppError } from './errors.ts'
import { logger } from './logger.ts'

export async function rateLimit(
    key: string,
    limit: number,
    windowSecs: number,
): Promise<void> {
    const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

    if (!redisUrl || !redisToken) {
        // Graceful degradation: skip rate limiting in local/unconfigured environments
        logger.warn('Rate limiting skipped — Upstash not configured', { key })
        return
    }

    const rateLimitKey = `rl:${key}`

    try {
        // INCR the counter — Upstash REST API format: /incr/<key>
        const incrRes = await fetch(`${redisUrl}/incr/${encodeURIComponent(rateLimitKey)}`, {
            headers: { Authorization: `Bearer ${redisToken}` },
        })
        if (!incrRes.ok) throw new Error(`Redis INCR failed: ${incrRes.status}`)

        const { result: count } = await incrRes.json() as { result: number }

        // On first request, set the expiry window
        if (count === 1) {
            await fetch(
                `${redisUrl}/expire/${encodeURIComponent(rateLimitKey)}/${windowSecs}`,
                { headers: { Authorization: `Bearer ${redisToken}` } },
            )
        }

        if (count > limit) {
            logger.warn('Rate limit exceeded', { key, count, limit })
            throw new AppError(
                429,
                `Rate limit exceeded. Max ${limit} requests per ${windowSecs}s.`,
                'RATE_LIMITED',
            )
        }
    } catch (err) {
        if (err instanceof AppError) throw err
        // Redis connectivity issues should not block the request
        logger.error('Rate limit check failed — allowing request', {
            key,
            error: String(err),
        })
    }
}
