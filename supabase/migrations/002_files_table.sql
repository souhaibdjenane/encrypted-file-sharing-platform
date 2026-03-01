-- Migration 002: files table
-- Core table that records every encrypted file uploaded by a user.
-- The actual file bytes live in Supabase Storage; this table holds
-- the encrypted metadata and access-control fields.

CREATE TABLE IF NOT EXISTS public.files (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path        TEXT        NOT NULL,
    -- Client-encrypted JSON blob: { ciphertext: string, iv: string }
    encrypted_metadata  JSONB       NOT NULL DEFAULT '{}',
    file_size_bytes     BIGINT      NOT NULL DEFAULT 0,
    mime_type           TEXT        NOT NULL DEFAULT 'application/octet-stream',
    -- Base64 IV used to encrypt the file content in Storage
    iv                  TEXT        NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ,
    download_limit      INT,                             -- NULL = unlimited
    download_count      INT         NOT NULL DEFAULT 0,
    CONSTRAINT download_count_non_negative CHECK (download_count >= 0)
);

COMMENT ON TABLE public.files IS
    'Records every encrypted file. Actual bytes are in Supabase Storage.';
COMMENT ON COLUMN public.files.encrypted_metadata IS
    'AES-256-GCM encrypted JSON blob containing file name, size, and MIME type. '
    'Only the recipient with the wrapped key can decrypt this.';
COMMENT ON COLUMN public.files.iv IS
    'Base64-encoded AES-GCM IV used to encrypt the file content in Storage.';
