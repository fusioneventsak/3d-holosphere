/*
  # Initial Schema Setup
  
  1. Tables
    - collages: Stores collage metadata and ownership
    - photos: Stores photo URLs and collage associations
    - settings: Global application settings
    - sound_settings: Per-user sound preferences
  
  2. Security
    - RLS enabled on all tables
    - Policies for authenticated and anonymous access
    
  3. Performance
    - Indexes on frequently queried columns
    - Triggers for timestamp updates
*/

-- Create collages table
CREATE TABLE IF NOT EXISTS collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT code_format CHECK (code ~ '^[A-Z0-9]{4}$')
);

-- Enable RLS on collages
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;

-- Drop existing collages policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view collages by code" ON collages;
  DROP POLICY IF EXISTS "Users can create collages" ON collages;
  DROP POLICY IF EXISTS "Users can delete own collages" ON collages;
  DROP POLICY IF EXISTS "Users can update own collages" ON collages;
  DROP POLICY IF EXISTS "Users can view own collages" ON collages;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Collages policies
CREATE POLICY "Anyone can view collages by code"
  ON collages FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can create collages"
  ON collages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collages"
  ON collages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own collages"
  ON collages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own collages"
  ON collages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid REFERENCES collages(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on photos
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Drop existing photos policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view photos" ON photos;
  DROP POLICY IF EXISTS "Users can add photos to own collages" ON photos;
  DROP POLICY IF EXISTS "Users can delete photos from own collages" ON photos;
  DROP POLICY IF EXISTS "Users can update photos in own collages" ON photos;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Photos policies
CREATE POLICY "Anyone can view photos"
  ON photos FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Users can add photos to own collages"
  ON photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM collages
      WHERE collages.id = photos.collage_id
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete photos from own collages"
  ON photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM collages
      WHERE collages.id = photos.collage_id
      AND collages.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update photos in own collages"
  ON photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM collages
      WHERE collages.id = photos.collage_id
      AND collages.user_id = auth.uid()
    )
  );

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color text DEFAULT '#8b5cf6',
  secondary_color text DEFAULT '#14b8a6',
  logo_url text,
  background_url text,
  grid_size integer DEFAULT 4,
  gamification_enabled boolean DEFAULT true,
  sponsor_logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing settings policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public users can view settings" ON settings;
  DROP POLICY IF EXISTS "Authenticated users can manage settings" ON settings;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Settings policies
CREATE POLICY "Public users can view settings"
  ON settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage settings"
  ON settings
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create sound_settings table
CREATE TABLE IF NOT EXISTS sound_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  volume double precision DEFAULT 0.7,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on sound_settings
ALTER TABLE sound_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing sound_settings policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage their own sound settings" ON sound_settings;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Sound settings policies
CREATE POLICY "Users can manage their own sound settings"
  ON sound_settings
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS collages_user_id_idx ON collages(user_id);
CREATE INDEX IF NOT EXISTS collages_code_idx ON collages(code);
CREATE INDEX IF NOT EXISTS photos_collage_id_idx ON photos(collage_id);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sound_settings_updated_at ON sound_settings;
CREATE TRIGGER update_sound_settings_updated_at
  BEFORE UPDATE ON sound_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();