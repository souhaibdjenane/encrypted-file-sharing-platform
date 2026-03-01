-- supabase/seed.sql
-- Local development seed data.
-- Applied automatically by `supabase db reset` and `supabase start`.
--
-- ⚠ NEVER commit real credentials. These are local-only test users.

-- Insert a test user directly into auth.users so we can test without
-- the email confirmation flow in local development.
--
-- Password: TestPassword123!
-- Email   : alice@vaultshare.local
--
-- The encrypted_password is a bcrypt hash of "TestPassword123!"
-- generated with: SELECT crypt('TestPassword123!', gen_salt('bf', 10));

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice@vaultshare.local',
    '$2a$10$qOSZDPkDajnLVVkYBjF84.XWA0sn6A3cKfL3nMX63KrGZ7w1G3d7G',  -- TestPassword123!
    NOW(),
    '{"display_name": "Alice Test", "public_key": null}'::jsonb,
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
)
ON CONFLICT (id) DO NOTHING;

-- Also add the user to auth.identities (required for Supabase email/password flow)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "alice@vaultshare.local"}'::jsonb,
    'email',
    NOW(),
    NOW(),
    NOW()
)
ON CONFLICT (provider, id) DO NOTHING;
