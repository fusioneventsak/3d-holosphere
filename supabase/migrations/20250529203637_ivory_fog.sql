/*
  # Fix storage bucket permissions

  1. Storage Setup
    - Creates photos bucket with proper permissions
    - Sets file size limits and allowed MIME types
  
  2. Security
    - Sets up proper RLS policies for public access
    - Configures upload/delete permissions
*/

-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "storage" WITH SCHEMA "extensions";

-- Create photos bucket
DO $$
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
END $$;

-- Create security policies
DO $$
BEGIN
  -- Public read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Read Access'
  ) THEN
    CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'photos');
  END IF;

  -- Public upload access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Upload Access'
  ) THEN
    CREATE POLICY "Public Upload Access" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'photos');
  END IF;

  -- Public delete access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Delete Access'
  ) THEN
    CREATE POLICY "Public Delete Access" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'photos');
  END IF;

  -- Public update access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Update Access'
  ) THEN
    CREATE POLICY "Public Update Access" ON storage.objects
    FOR UPDATE TO public
    USING (bucket_id = 'photos')
    WITH CHECK (bucket_id = 'photos');
  END IF;
END $$;