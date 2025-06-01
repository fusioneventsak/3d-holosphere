/*
  # Configure storage bucket for photos

  1. Storage Configuration
    - Creates photos bucket with 10MB file size limit
    - Allows common image formats (JPEG, PNG, GIF, WebP)
    - Makes bucket publicly accessible
  
  2. Security
    - Sets up RLS policies for:
      - Public read access
      - Public upload access
      - Public delete access
      - Public update access
*/

-- Create photos bucket if it doesn't exist
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

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create security policies
DO $$
BEGIN
  -- Public read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Read Access - Photos'
  ) THEN
    CREATE POLICY "Public Read Access - Photos" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'photos');
  END IF;

  -- Public upload access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Upload Access - Photos'
  ) THEN
    CREATE POLICY "Public Upload Access - Photos" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'photos');
  END IF;

  -- Public delete access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Delete Access - Photos'
  ) THEN
    CREATE POLICY "Public Delete Access - Photos" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'photos');
  END IF;

  -- Public update access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public Update Access - Photos'
  ) THEN
    CREATE POLICY "Public Update Access - Photos" ON storage.objects
    FOR UPDATE TO public
    USING (bucket_id = 'photos')
    WITH CHECK (bucket_id = 'photos');
  END IF;
END $$;