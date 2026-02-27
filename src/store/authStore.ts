import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
    displayName: string | null   // user-editable, stored in user_metadata.display_name
    fullName: string | null      // from Google/provider full_name
    avatarUrl: string | null     // from Google/provider avatar_url
    email: string | null
}

interface AuthState {
    user: User | null
    profile: UserProfile
    isLoading: boolean
    setUser: (user: User | null) => void
    clearUser: () => void
    setLoading: (loading: boolean) => void
    setDisplayName: (name: string) => void
    setProfile: (updates: Partial<UserProfile>) => void
}

function extractProfile(user: User | null): UserProfile {
    if (!user) return { displayName: null, fullName: null, avatarUrl: null, email: null }
    const meta = user.user_metadata ?? {}
    return {
        // user-set display name takes priority, then Google full_name
        displayName: meta.display_name ?? meta.full_name ?? meta.name ?? null,
        fullName: meta.full_name ?? meta.name ?? null,
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
        email: user.email ?? null,
    }
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    profile: { displayName: null, fullName: null, avatarUrl: null, email: null },
    isLoading: true,
    setUser: (user) => set({ user, profile: extractProfile(user), isLoading: false }),
    clearUser: () => set({
        user: null,
        profile: { displayName: null, fullName: null, avatarUrl: null, email: null },
        isLoading: false,
    }),
    setLoading: (isLoading) => set({ isLoading }),
    // Optimistically update display name in store after API call
    setDisplayName: (name) => {
        const { profile } = get()
        set({ profile: { ...profile, displayName: name } })
    },
    setProfile: (updates) => {
        const { profile } = get()
        set({ profile: { ...profile, ...updates } })
    },
}))
