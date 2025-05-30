/*
  # Storage bucket and policies for photo uploads
  
  Creates a public storage bucket for photos with:
  - 10MB file size limit
  - Allowed image MIME types
  - Public access policies for CRUD operations
*/

-- Create photos bucket
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

-- Create storage policies
CREATE POLICY "photos_bucket_select_policy"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'photos');

CREATE POLICY "photos_bucket_insert_policy"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "photos_bucket_update_policy"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'photos')
WITH CHECK (bucket_id = 'photos');

CREATE POLICY "photos_bucket_delete_policy"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'photos');