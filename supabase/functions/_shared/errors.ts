/**
 * Shared error types and response helpers for VaultShare Edge Functions.
 */

import { corsHeaders } from './cors.ts'

export class AppError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly code?: string,
    ) {
        super(message)
        this.name = 'AppError'
    }
}

export function errorResponse(err: unknown): Response {
    if (err instanceof AppError) {
        return new Response(
            JSON.stringify({ error: err.message, code: err.code ?? null }),
            {
                status: err.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            },
        )
    }

    console.error('[errorResponse] Unexpected error:', err)
    return new Response(
        JSON.stringify({ error: 'Internal server error', code: 'INTERNAL' }),
        {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
    )
}

export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
}
