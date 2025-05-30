/*
  # Storage bucket and policies for photos

  1. Changes
    - Create photos storage bucket
    - Set up public access policies
    - Configure file size limits and MIME types
  
  2. Security
    - Enable public read/write access to photos bucket
    - Limit file size to 10MB
    - Restrict to image file types only
*/

-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "storage";

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

-- Create storage policies
CREATE POLICY "Give users access to own folder 1rn2mk_0"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

CREATE POLICY "Give users access to own folder 1rn2mk_1"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Give users access to own folder 1rn2mk_2"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'photos')
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Give users access to own folder 1rn2mk_3"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'photos');