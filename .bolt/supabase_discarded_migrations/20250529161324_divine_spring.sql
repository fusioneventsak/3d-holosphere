-- Enable storage by creating the extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "storage" WITH SCHEMA "extensions";

-- Create a function to ensure the photos bucket exists and is public
CREATE OR REPLACE FUNCTION public.create_storage_bucket()
RETURNS void AS $$
BEGIN
    -- Create the bucket if it doesn't exist
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

    -- Create policies for the bucket
    EXECUTE format($pol$
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'photos');
    $pol$);

    EXECUTE format($pol$
        CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'photos' AND
            (SPLIT_PART(name, '/', 1) = auth.uid()::text OR SPLIT_PART(name, '/', 1) IN (
                SELECT id::text FROM public.collages WHERE user_id = auth.uid()
            ))
        );
    $pol$);

    EXECUTE format($pol$
        CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated
        USING (
            bucket_id = 'photos' AND
            (SPLIT_PART(name, '/', 1) = auth.uid()::text OR SPLIT_PART(name, '/', 1) IN (
                SELECT id::text FROM public.collages WHERE user_id = auth.uid()
            ))
        );
    $pol$);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function as superuser
SELECT public.create_storage_bucket();

-- Clean up by dropping the function
DROP FUNCTION public.create_storage_bucket();