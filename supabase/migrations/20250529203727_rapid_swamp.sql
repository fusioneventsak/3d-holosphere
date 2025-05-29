/*
  # Storage bucket and policies for photo uploads

  This migration creates:
  1. A public storage bucket for photos with size limits and mime type restrictions
  2. Security policies to allow public access for CRUD operations on photos
*/

-- Create bucket function
CREATE OR REPLACE FUNCTION create_storage_bucket()
RETURNS void AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'photos',
    'photos',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];
END;
$$ LANGUAGE plpgsql;

-- Execute bucket creation
SELECT create_storage_bucket();

-- Drop the function after use
DROP FUNCTION create_storage_bucket();

-- Create policies function
CREATE OR REPLACE FUNCTION create_storage_policies()
RETURNS void AS $$
BEGIN
  -- Public read access
  DROP POLICY IF EXISTS "Public Read Access - Photos" ON storage.objects;
  CREATE POLICY "Public Read Access - Photos" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'photos');

  -- Public upload access
  DROP POLICY IF EXISTS "Public Upload Access - Photos" ON storage.objects;
  CREATE POLICY "Public Upload Access - Photos" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'photos');

  -- Public delete access
  DROP POLICY IF EXISTS "Public Delete Access - Photos" ON storage.objects;
  CREATE POLICY "Public Delete Access - Photos" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'photos');

  -- Public update access
  DROP POLICY IF EXISTS "Public Update Access - Photos" ON storage.objects;
  CREATE POLICY "Public Update Access - Photos" ON storage.objects
    FOR UPDATE TO public
    USING (bucket_id = 'photos')
    WITH CHECK (bucket_id = 'photos');
END;
$$ LANGUAGE plpgsql;

-- Execute policy creation
SELECT create_storage_policies();

-- Drop the function after use
DROP FUNCTION create_storage_policies();