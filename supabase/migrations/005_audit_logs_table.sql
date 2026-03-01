-- Migration 005: audit_logs table
-- Immutable append-only log of security-relevant events.
-- Populated by Edge Functions; never updated, never deleted by users.
-- Uses BIGSERIAL for efficient time-ordered queries.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    file_id     UUID        REFERENCES public.files(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL,            -- e.g. 'upload', 'download', 'share', 'revoke'
    ip_address  INET,
    user_agent  TEXT,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS
    'Append-only security audit log. Populated by Edge Functions, never mutated.';
COMMENT ON COLUMN public.audit_logs.action IS
    'Short action identifier, e.g. upload | download | share | revoke | presign.';
COMMENT ON COLUMN public.audit_logs.metadata IS
    'Arbitrary JSON context for the event (e.g. share token, file size, error reason).';
