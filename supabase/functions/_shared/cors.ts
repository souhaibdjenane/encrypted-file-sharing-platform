/**
 * Shared CORS headers for all VaultShare Edge Functions.
 *
 * ALLOWED_ORIGIN env var controls which origin is permitted.
 * Falls back to "*" for local development.
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

export const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    'Access-Control-Max-Age': '86400',
}

/**
 * Returns a 204 response for preflight OPTIONS requests.
 */
export function handleCors(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders })
    }
    return null
}
