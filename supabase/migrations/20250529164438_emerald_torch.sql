-- Create storage bucket for photos
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

-- Create policies for the photos bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'photos');

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'photos' AND
    (SPLIT_PART(name, '/', 1) = auth.uid()::text OR SPLIT_PART(name, '/', 1) IN (
        SELECT id::text FROM public.collages WHERE user_id = auth.uid()
    ))
);

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'photos' AND
    (SPLIT_PART(name, '/', 1) = auth.uid()::text OR SPLIT_PART(name, '/', 1) IN (
        SELECT id::text FROM public.collages WHERE user_id = auth.uid()
    ))
);