import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'Missing Supabase environment variables! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local'
    )
}

/**
 * Single Supabase client singleton for the entire application.
 *
 * IMPORTANT: Never call createClient() elsewhere — always import this instance.
 * Having two separate client instances causes JWT 401 errors because each
 * manages its own auth token storage independently.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        // Keep the user's session alive across page reloads
        persistSession: true,
        // Automatically refresh the JWT before it expires
        autoRefreshToken: true,
        // Pick up tokens from OAuth callback URLs
        detectSessionInUrl: true,
        // Use localStorage (default) — consistent with the auth listener in useAuth
        storage: window.localStorage,
    },
})
