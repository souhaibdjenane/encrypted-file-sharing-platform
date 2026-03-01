-- Migration 003: file_keys table
-- Stores one RSA-wrapped AES file key per (file, user) pair.
-- The wrapped_key is the AES-256-GCM file key encrypted (wrapped)
-- with the user's RSA-OAEP 4096-bit public key.
-- Only the holder of the matching private key can unwrap it.

CREATE TABLE IF NOT EXISTS public.file_keys (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id     UUID        NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Base64 RSA-OAEP wrapped AES key
    wrapped_key TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT file_keys_file_user_unique UNIQUE (file_id, user_id)
);

COMMENT ON TABLE public.file_keys IS
    'One row per (file, user): holds the RSA-wrapped AES file key for that user.';
COMMENT ON COLUMN public.file_keys.wrapped_key IS
    'Base64-encoded AES-256-GCM file key wrapped with the user''s RSA-OAEP public key.';
