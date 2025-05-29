-- This migration removes authentication requirements from the application
-- to allow anonymous users to create and manage collages

-- Update policies for collages table
DROP POLICY IF EXISTS "Users can create collages" ON collages;
DROP POLICY IF EXISTS "Users can delete own collages" ON collages;
DROP POLICY IF EXISTS "Users can update own collages" ON collages;
DROP POLICY IF EXISTS "Users can view own collages" ON collages;

-- Create new open policies for collages
CREATE POLICY "Anyone can create collages" ON collages
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can delete collages" ON collages
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Anyone can update collages" ON collages
  FOR UPDATE
  TO public
  USING (true);

-- Update policies for collage_settings
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;

CREATE POLICY "Anyone can manage collage settings" ON collage_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Update policies for photos
DROP POLICY IF EXISTS "Users can add photos to own collages" ON photos;
DROP POLICY IF EXISTS "Users can delete photos from own collages" ON photos;
DROP POLICY IF EXISTS "Users can update photos in own collages" ON photos;
DROP POLICY IF EXISTS "Users can manage photos in own collages" ON photos;

CREATE POLICY "Anyone can add photos to collages" ON photos
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can manage photos" ON photos
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Make collages table not require user_id
ALTER TABLE collages ALTER COLUMN user_id DROP NOT NULL;

-- Update create_default_collage_settings trigger function to handle null user_id
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
$$ LANGUAGE plpgsql;