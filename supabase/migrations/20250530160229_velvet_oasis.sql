-- First, clean up existing data
DELETE FROM photos;
DELETE FROM collage_settings;
DELETE FROM collages;
DELETE FROM stock_photos;

-- Clean up storage
DO $$
BEGIN
  -- Delete all files in the photos bucket
  DELETE FROM storage.objects WHERE bucket_id = 'photos';
END $$;

-- Drop existing storage policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Drop and recreate tables to ensure clean state
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS collage_settings CASCADE;
DROP TABLE IF EXISTS collages CASCADE;
DROP TABLE IF EXISTS stock_photos CASCADE;

-- Create tables fresh
CREATE TABLE collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE collage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE stock_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Recreate indexes
CREATE INDEX collages_code_idx ON collages(code);
CREATE INDEX collages_user_id_idx ON collages(user_id);
CREATE INDEX photos_collage_id_idx ON photos(collage_id);
CREATE INDEX collage_settings_collage_id_idx ON collage_settings(collage_id);
CREATE UNIQUE INDEX collage_settings_collage_id_key ON collage_settings(collage_id);

-- Enable RLS
ALTER TABLE collages ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Anyone can create collages"
  ON collages FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view collages"
  ON collages FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can update collages"
  ON collages FOR UPDATE TO public
  USING (true);

CREATE POLICY "Anyone can delete collages"
  ON collages FOR DELETE TO public
  USING (true);

CREATE POLICY "Anyone can add photos to collages"
  ON photos FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view photos"
  ON photos FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can manage photos"
  ON photos FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can manage collage settings"
  ON collage_settings FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view collage settings"
  ON collage_settings FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can view stock photos"
  ON stock_photos FOR SELECT TO public
  USING (true);

-- Create storage policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'photos');

-- Recreate trigger functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

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

CREATE TRIGGER update_collage_settings_updated_at
  BEFORE UPDATE ON collage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER create_collage_settings
  AFTER INSERT ON collages
  FOR EACH ROW
  EXECUTE FUNCTION create_default_collage_settings();