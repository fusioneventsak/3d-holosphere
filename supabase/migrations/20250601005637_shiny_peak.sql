-- Create collages table
CREATE TABLE IF NOT EXISTS collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

-- Set up Row Level Security
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating
DROP POLICY IF EXISTS "Users can view own collages" ON collages;
DROP POLICY IF EXISTS "Users can create collages" ON collages;
DROP POLICY IF EXISTS "Users can update own collages" ON collages;
DROP POLICY IF EXISTS "Users can delete own collages" ON collages;
DROP POLICY IF EXISTS "Anyone can view collages by code" ON collages;
DROP POLICY IF EXISTS "Users can view photos from own collages" ON photos;
DROP POLICY IF EXISTS "Users can add photos to own collages" ON photos;
DROP POLICY IF EXISTS "Users can update photos in own collages" ON photos;
DROP POLICY IF EXISTS "Users can delete photos from own collages" ON photos;
DROP POLICY IF EXISTS "Anyone can view photos" ON photos;

-- Create policies for collages table
CREATE POLICY "Users can view own collages" 
  ON collages 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create collages" 
  ON collages 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collages" 
  ON collages 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collages" 
  ON collages 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view collages by code" 
  ON collages 
  FOR SELECT 
  TO anon 
  USING (true);

-- Create policies for photos table
CREATE POLICY "Users can view photos from own collages" 
  ON photos 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM collages 
      WHERE collages.id = photos.collage_id 
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add photos to own collages" 
  ON photos 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collages 
      WHERE collages.id = photos.collage_id 
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update photos in own collages" 
  ON photos 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM collages 
      WHERE collages.id = photos.collage_id 
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete photos from own collages" 
  ON photos 
  FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM collages 
      WHERE collages.id = photos.collage_id 
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view photos" 
  ON photos 
  FOR SELECT 
  TO anon 
  USING (true);

-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Public can view photos"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'photos');