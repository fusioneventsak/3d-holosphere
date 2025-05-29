-- Create a function to ensure the photos bucket exists and is public
CREATE OR REPLACE FUNCTION public.create_storage_bucket()
RETURNS void AS $$
BEGIN
    -- Create policies for the bucket
    EXECUTE format($pol$
        DROP POLICY IF EXISTS "Public Access" ON storage.objects;
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'photos');
    $pol$);

    EXECUTE format($pol$
        DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
        CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'photos' AND
            (SPLIT_PART(name, '/', 1) = auth.uid()::text OR SPLIT_PART(name, '/', 1) IN (
                SELECT id::text FROM public.collages WHERE user_id = auth.uid()
            ))
        );
    $pol$);

    EXECUTE format($pol$
        DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
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

-- Execute the function
SELECT public.create_storage_bucket();

-- Clean up by dropping the function
DROP FUNCTION public.create_storage_bucket();