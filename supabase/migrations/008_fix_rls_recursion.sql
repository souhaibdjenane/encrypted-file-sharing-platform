-- Migration 007: Fix infinite recursion in RLS policies
--
-- ROOT CAUSE:
--   The "files: shared users can select" policy does:
--     EXISTS (SELECT 1 FROM shares WHERE shares.file_id = files.id ...)
--   The "shares: owner full access" policy does:
--     EXISTS (SELECT 1 FROM files WHERE files.id = shares.file_id ...)
--   
--   Postgres evaluates both as mutually dependent → infinite recursion.
--
-- FIX:
--   Replace the shares sub-query in the files policy with a
--   SECURITY DEFINER function that bypasses RLS when checking shares.
--   This breaks the cycle.

-- Step 1: Drop the recursive policy on files
DROP POLICY IF EXISTS "files: shared users can select" ON public.files;

-- Step 2: Create a security-definer helper (bypasses RLS itself so no recursion)
CREATE OR REPLACE FUNCTION public.user_has_valid_share(p_file_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shares s
    WHERE s.file_id = p_file_id
      AND s.revoked = FALSE
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND (
          s.shared_with = p_user_id   -- direct share
          OR s.shared_with IS NULL    -- public link
      )
  );
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.user_has_valid_share(UUID, UUID) TO authenticated, anon;

-- Step 3: Re-create the files policy using the helper function (no recursion)
CREATE POLICY "files: shared users can select"
    ON public.files
    FOR SELECT
    USING (
        public.user_has_valid_share(id, auth.uid())
    );
