-- Migration 007: Performance indexes
-- Covers all common query patterns used by the Edge Functions and client queries.

-- files: look up by owner (dashboard listing)
CREATE INDEX IF NOT EXISTS idx_files_owner_id
    ON public.files(owner_id);

-- files: find expired files for cleanup jobs
CREATE INDEX IF NOT EXISTS idx_files_expires_at
    ON public.files(expires_at)
    WHERE expires_at IS NOT NULL;

-- file_keys: look up by file (bulk share operations)
CREATE INDEX IF NOT EXISTS idx_file_keys_file_id
    ON public.file_keys(file_id);

-- file_keys: look up by user (find all keys for a user)
CREATE INDEX IF NOT EXISTS idx_file_keys_user_id
    ON public.file_keys(user_id);

-- shares: list shares for a file (owner management view)
CREATE INDEX IF NOT EXISTS idx_shares_file_id
    ON public.shares(file_id);

-- shares: list shares received by a user (inbox view)
CREATE INDEX IF NOT EXISTS idx_shares_shared_with
    ON public.shares(shared_with)
    WHERE shared_with IS NOT NULL;

-- shares: token lookup (public link access flow)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_token
    ON public.shares(token);

-- shares: active shares query (non-revoked, non-expired)
CREATE INDEX IF NOT EXISTS idx_shares_active
    ON public.shares(file_id, revoked, expires_at)
    WHERE revoked = FALSE;

-- audit_logs: per-user log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON public.audit_logs(user_id);

-- audit_logs: per-file log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_file_id
    ON public.audit_logs(file_id);

-- audit_logs: time-range queries (BIGSERIAL id is already ordered)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs(created_at DESC);
