-- Migration 004: shares table
-- Records every share grant: who shared which file with whom,
-- under what permissions, and whether it has been revoked.
-- shared_with is nullable to support public-link sharing (token only).

CREATE TABLE IF NOT EXISTS public.shares (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id       UUID        NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    shared_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- NULL means "public link" (anyone with the token can access)
    shared_with   UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Unique token sent in download/share URLs
    token         TEXT        NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
    can_download  BOOLEAN     NOT NULL DEFAULT TRUE,
    can_reshare   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ,
    revoked       BOOLEAN     NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.shares IS
    'Tracks file share grants. shared_with=NULL means a public link (token-based access).';
COMMENT ON COLUMN public.shares.token IS
    'Cryptographically random 64-hex-char token used to identify this share in URLs.';
COMMENT ON COLUMN public.shares.revoked IS
    'Set to TRUE by the owner to revoke access without deleting the record.';
