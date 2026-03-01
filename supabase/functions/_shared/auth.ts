/**
 * JWT authentication helper for VaultShare Edge Functions.
 *
 * Extracts and validates the Bearer token from the Authorization header
 * using the Supabase service-role client. Returns the authenticated user
 * and a user-scoped Supabase client for RLS-enforced queries.
 */

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import { AppError } from './errors.ts'

export interface AuthContext {
    user: User
    /** User-scoped client — respects RLS */
    supabase: SupabaseClient
    /** Service-role client — bypasses RLS (use for audit log writes) */
    adminSupabase: SupabaseClient
}

export async function verifyAuth(req: Request): Promise<AuthContext> {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        throw new AppError(401, 'Missing or invalid Authorization header', 'UNAUTHORIZED')
    }

    const token = authHeader.slice(7)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // User-scoped client using the caller's JWT — respects RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // Admin client for service-level operations (audit logs, etc.)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) {
        throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED')
    }

    return { user, supabase: userClient, adminSupabase: adminClient }
}
