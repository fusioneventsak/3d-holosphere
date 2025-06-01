/*
  # Initial Schema Setup

  1. Tables
    - `collages`: Stores collage metadata and settings
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `name` (text)
      - `user_id` (uuid, optional)
      - `created_at` (timestamp)
    
    - `photos`: Stores photo information
      - `id` (uuid, primary key)
      - `collage_id` (uuid, references collages)
      - `url` (text)
      - `created_at` (timestamp)

  2. Storage
    - Creates 'photos' bucket for storing uploaded images
    - Sets up public access policies

  3. Security
    - Enables RLS on all tables
    - Sets up policies for authenticated and anonymous access
*/

-- Create collages table
CREATE TABLE IF NOT EXISTS collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS collages_code_idx ON collages(code);
CREATE INDEX IF NOT EXISTS collages_user_id_idx ON collages(user_id);
CREATE INDEX IF NOT EXISTS photos_collage_id_idx ON photos(collage_id);

-- Create storage bucket for photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Collage Policies
CREATE POLICY "Anyone can create collages"
  ON collages
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view collages"
  ON collages
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update collages"
  ON collages
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete collages"
  ON collages
  FOR DELETE
  TO public
  USING (true);

-- Photo Policies
CREATE POLICY "Anyone can insert photos"
  ON photos
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view photos"
  ON photos
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can delete photos"
  ON photos
  FOR DELETE
  TO public
  USING (true);

-- Storage Policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can access photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'photos');