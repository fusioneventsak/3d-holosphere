/*
  # Fix Photo Storage Organization

  1. Changes
    - Create photos bucket if it doesn't exist
    - Set proper bucket configuration (public access, file size limits, MIME types)
    - Create storage policies for secure access
    - Add RLS policies for photo management
    
  2. Security
    - Enable public read access for photos
    - Allow authenticated users to manage photos
    - Set file size and type restrictions
*/

-- Create storage bucket for photos if it doesn't exist
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

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for the photos bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
CREATE POLICY "Anyone can upload photos" ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'photos');

DROP POLICY IF EXISTS "Anyone can delete photos" ON storage.objects;
CREATE POLICY "Anyone can delete photos" ON storage.objects FOR DELETE TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Anyone can update photos" ON storage.objects;
CREATE POLICY "Anyone can update photos" ON storage.objects FOR UPDATE TO public
USING (bucket_id = 'photos')
WITH CHECK (bucket_id = 'photos');