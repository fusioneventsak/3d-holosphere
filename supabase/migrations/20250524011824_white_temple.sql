/*
  # Create collages and photos tables
  
  1. New Tables
    - `collages`: Stores collage metadata
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `name` (text)
      - `user_id` (uuid, nullable)
      - `created_at` (timestamp)
    
    - `photos`: Stores photo information
      - `id` (uuid, primary key)
      - `collage_id` (uuid, references collages)
      - `url` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access
*/

-- Create collages table
CREATE TABLE IF NOT EXISTS public.collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid REFERENCES collages(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies for collages
CREATE POLICY "Anyone can create collages"
  ON collages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view collages"
  ON collages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own collages"
  ON collages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collages"
  ON collages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for photos
CREATE POLICY "Anyone can view photos"
  ON photos FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can add photos"
  ON photos FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can manage photos in own collages"
  ON photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collages
      WHERE collages.id = photos.collage_id
      AND collages.user_id = auth.uid()
    )
  );

-- Create storage bucket for photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'photos');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS collages_user_id_idx ON collages(user_id);
CREATE INDEX IF NOT EXISTS collages_code_idx ON collages(code);
CREATE INDEX IF NOT EXISTS photos_collage_id_idx ON photos(collage_id);