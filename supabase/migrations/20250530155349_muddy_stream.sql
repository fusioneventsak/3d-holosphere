/*
  # Database Schema for 3D Photo Collage Application

  1. Tables
    - collages: Stores collage metadata and settings
    - photos: Stores uploaded photos
    - collage_settings: Stores 3D scene configuration
    - stock_photos: Stores default stock photos
  
  2. Security
    - Enables RLS on all tables
    - Creates public access policies
    - Sets up storage bucket policies
  
  3. Triggers
    - Automatic timestamp updates
    - Default collage settings creation
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can create collages" ON collages;
DROP POLICY IF EXISTS "Anyone can view collages" ON collages;
DROP POLICY IF EXISTS "Anyone can update collages" ON collages;
DROP POLICY IF EXISTS "Anyone can delete collages" ON collages;
DROP POLICY IF EXISTS "Anyone can add photos to collages" ON photos;
DROP POLICY IF EXISTS "Anyone can view photos" ON photos;
DROP POLICY IF EXISTS "Anyone can manage photos" ON photos;
DROP POLICY IF EXISTS "Anyone can manage collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can view stock photos" ON stock_photos;
DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;

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

-- Create collage_settings table
CREATE TABLE IF NOT EXISTS collage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  settings jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create stock_photos table
CREATE TABLE IF NOT EXISTS stock_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS collages_code_idx ON collages(code);
CREATE INDEX IF NOT EXISTS collages_user_id_idx ON collages(user_id);
CREATE INDEX IF NOT EXISTS photos_collage_id_idx ON photos(collage_id);
CREATE INDEX IF NOT EXISTS collage_settings_collage_id_idx ON collage_settings(collage_id);
CREATE UNIQUE INDEX IF NOT EXISTS collage_settings_collage_id_key ON collage_settings(collage_id);

-- Create storage bucket for photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;

-- Collage Policies
CREATE POLICY "Anyone can create collages"
  ON collages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view collages"
  ON collages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update collages"
  ON collages FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete collages"
  ON collages FOR DELETE
  TO public
  USING (true);

-- Photo Policies
CREATE POLICY "Anyone can add photos to collages"
  ON photos FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view photos"
  ON photos FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can manage photos"
  ON photos FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Collage Settings Policies
CREATE POLICY "Anyone can manage collage settings"
  ON collage_settings FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view collage settings"
  ON collage_settings FOR SELECT
  TO public
  USING (true);

-- Stock Photos Policies
CREATE POLICY "Anyone can view stock photos"
  ON stock_photos FOR SELECT
  TO public
  USING (true);

-- Storage Policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'photos');

-- Create trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_collage_settings_updated_at ON collage_settings;
DROP TRIGGER IF EXISTS create_collage_settings ON collages;

-- Create trigger for collage_settings
CREATE TRIGGER update_collage_settings_updated_at
  BEFORE UPDATE ON collage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger function for default collage settings
CREATE OR REPLACE FUNCTION create_default_collage_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO collage_settings (collage_id, settings)
  VALUES (
    NEW.id,
    '{
      "gridSize": 200,
      "floorSize": 200,
      "gridColor": "#444444",
      "photoSize": 0.8,
      "floorColor": "#1A1A1A",
      "photoCount": 50,
      "wallHeight": 0,
      "gridEnabled": true,
      "gridOpacity": 1.0,
      "cameraHeight": 10,
      "floorEnabled": true,
      "floorOpacity": 0.8,
      "photoSpacing": 0,
      "cameraEnabled": true,
      "gridDivisions": 30,
      "animationSpeed": 0.5,
      "cameraDistance": 25,
      "emptySlotColor": "#1A1A1A",
      "floorMetalness": 0.4,
      "floorRoughness": 0.5,
      "spotlightAngle": 0.7853981633974483,
      "spotlightColor": "#ffffff",
      "spotlightCount": 2,
      "spotlightWidth": 0.8,
      "useStockPhotos": true,
      "backgroundColor": "#000000",
      "gridAspectRatio": 1.5,
      "spotlightHeight": 15,
      "animationEnabled": false,
      "animationPattern": "grid",
      "floorReflectivity": 0.6,
      "spotlightDistance": 30,
      "spotlightPenumbra": 0.8,
      "backgroundGradient": false,
      "spotlightIntensity": 100.0,
      "cameraRotationSpeed": 0.2,
      "ambientLightIntensity": 0.5,
      "backgroundGradientEnd": "#1a1a1a",
      "cameraRotationEnabled": true,
      "backgroundGradientAngle": 180,
      "backgroundGradientStart": "#000000"
    }'::jsonb
  );
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for default collage settings
CREATE TRIGGER create_collage_settings
  AFTER INSERT ON collages
  FOR EACH ROW
  EXECUTE FUNCTION create_default_collage_settings();

-- Insert initial stock photos
INSERT INTO stock_photos (url, category)
VALUES
  ('https://images.pexels.com/photos/1839564/pexels-photo-1839564.jpeg', 'people'),
  ('https://images.pexels.com/photos/2896853/pexels-photo-2896853.jpeg', 'people'),
  ('https://images.pexels.com/photos/3876394/pexels-photo-3876394.jpeg', 'people'),
  ('https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg', 'people'),
  ('https://images.pexels.com/photos/3812207/pexels-photo-3812207.jpeg', 'people'),
  ('https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg', 'people'),
  ('https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg', 'people'),
  ('https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg', 'people'),
  ('https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg', 'people'),
  ('https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg', 'people'),
  ('https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg', 'people'),
  ('https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg', 'people'),
  ('https://images.pexels.com/photos/5198239/pexels-photo-5198239.jpeg', 'people'),
  ('https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg', 'people'),
  ('https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg', 'people'),
  ('https://images.pexels.com/photos/834863/pexels-photo-834863.jpeg', 'people'),
  ('https://images.pexels.com/photos/3662900/pexels-photo-3662900.jpeg', 'people'),
  ('https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg', 'people'),
  ('https://images.pexels.com/photos/3785424/pexels-photo-3785424.jpeg', 'people'),
  ('https://images.pexels.com/photos/4101252/pexels-photo-4101252.jpeg', 'people'),
  ('https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg', 'landscape')
ON CONFLICT DO NOTHING;