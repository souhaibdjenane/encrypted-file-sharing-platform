-- Migration 006: Row Level Security policies
-- Enables RLS on all four tables and defines fine-grained access rules.
-- All policies use auth.uid() to identify the authenticated caller.

-- ── files ─────────────────────────────────────────────────────────────────

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Owners have full CRUD access to their own files
CREATE POLICY "files: owner full access"
    ON public.files
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Authenticated users with a valid (non-revoked, non-expired) share can SELECT
CREATE POLICY "files: shared users can select"
    ON public.files
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.shares s
            WHERE s.file_id    = files.id
              AND s.revoked    = FALSE
              AND (s.expires_at IS NULL OR s.expires_at > NOW())
              AND (
                  s.shared_with = auth.uid()           -- direct user share
                  OR s.shared_with IS NULL              -- public link
              )
        )
    );

-- ── file_keys ─────────────────────────────────────────────────────────────

ALTER TABLE public.file_keys ENABLE ROW LEVEL SECURITY;

-- Users can only read their own wrapped keys
CREATE POLICY "file_keys: users select own"
    ON public.file_keys
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only insert their own wrapped keys
CREATE POLICY "file_keys: users insert own"
    ON public.file_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own wrapped keys (key rotation)
CREATE POLICY "file_keys: users delete own"
    ON public.file_keys
    FOR DELETE
    USING (auth.uid() = user_id);

-- ── shares ────────────────────────────────────────────────────────────────

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- File owners can manage (view, create, update) all shares for their files
CREATE POLICY "shares: owner full access"
    ON public.shares
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.files f
            WHERE f.id = shares.file_id
              AND f.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.files f
            WHERE f.id = shares.file_id
              AND f.owner_id = auth.uid()
        )
    );

-- Recipients can SELECT shares directed at them
CREATE POLICY "shares: recipients select own"
    ON public.shares
    FOR SELECT
    USING (auth.uid() = shared_with OR shared_with IS NULL);

-- ── audit_logs ────────────────────────────────────────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit log entries
CREATE POLICY "audit_logs: users select own"
    ON public.audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- No user can insert/update/delete audit_logs directly (Edge Functions use service role)
