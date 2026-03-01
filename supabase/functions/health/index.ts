/**
 * health — GET /functions/v1/health
 *
 * Simple liveness check. No auth required.
 * Returns: { status: "ok", ts: ISO-8601 }
 */

import { handleCors, corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
    const preflight = handleCors(req)
    if (preflight) return preflight

    return new Response(
        JSON.stringify({ status: 'ok', ts: new Date().toISOString() }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
    )
})
