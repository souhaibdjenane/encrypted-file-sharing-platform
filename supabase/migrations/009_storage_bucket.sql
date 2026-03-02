-- Migration 009: storage bucket
-- Creates the 'encrypted-files' bucket and sets up RLS policies.

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('encrypted-files', 'encrypted-files', false)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS on storage.objects is enabled by default in Supabase.
-- Attempting to ALTER TABLE here causes permission errors for the migration user.

-- 3. Policy: Allow users to upload to their own folder
-- Path format: {auth.uid()}/{uuid}-{filename}
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'encrypted-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Policy: Allow users to select their own files
CREATE POLICY "Users can select their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'encrypted-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Policy: Allow the service role to manage everything (for cleanup jobs/Edge Functions)
-- (Supabase already has a service_role policy, but we'll be explicit if needed)

-- 6. Policy: Allow recipients to download shared files
-- This is tricky because recipients don't own the file.
-- However, we use SIGNED URLs for downloads, which bypasses RLS if generated with service_role.
-- Our download-presign function uses the service_role key to generate the URL.
