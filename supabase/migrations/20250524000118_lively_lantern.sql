/*
  # Initial Schema for PhotoSphere App

  1. New Tables
    - `collages`
      - `id` (uuid, primary key)
      - `code` (text, unique, for sharing)
      - `name` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp with time zone)
    
    - `photos`
      - `id` (uuid, primary key)
      - `collage_id` (uuid, references collages)
      - `url` (text, for photo URL)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for public viewing of collages
*/

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

-- Create policies for collages table
-- 1. Allow users to select their own collages
CREATE POLICY "Users can view own collages" 
  ON collages 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 2. Allow users to insert their own collages
CREATE POLICY "Users can create collages" 
  ON collages 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- 3. Allow users to update their own collages
CREATE POLICY "Users can update own collages" 
  ON collages 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 4. Allow users to delete their own collages
CREATE POLICY "Users can delete own collages" 
  ON collages 
  FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- 5. Allow anyone to view collages by code (for public sharing)
CREATE POLICY "Anyone can view collages by code" 
  ON collages 
  FOR SELECT 
  TO anon 
  USING (true);

-- Create policies for photos table
-- 1. Allow users to select photos from their own collages
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

-- 2. Allow users to insert photos into their own collages
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

-- 3. Allow users to update photos in their own collages
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

-- 4. Allow users to delete photos from their own collages
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

-- 5. Allow anyone to view photos (for public sharing)
CREATE POLICY "Anyone can view photos" 
  ON photos 
  FOR SELECT 
  TO anon 
  USING (true);

-- Create storage policy to allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'photos');

-- Create storage policy to allow public access to photos
CREATE POLICY "Public can view photos"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'photos');