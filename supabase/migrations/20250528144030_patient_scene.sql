/*
  # Collage Settings Security and Triggers

  1. Security
    - Enable RLS on collage_settings table
    - Add policies for viewing and managing settings
  
  2. Triggers
    - Create trigger for automatically creating default settings for new collages
    - Add safety check to prevent duplicate trigger creation
*/

-- Enable RLS
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Allow public to view settings
CREATE POLICY "Anyone can view collage settings" ON collage_settings
  FOR SELECT
  TO public
  USING (true);

-- Allow collage owners to manage their settings
CREATE POLICY "Users can manage their collage settings" ON collage_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collages
      WHERE collages.id = collage_settings.collage_id
      AND collages.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collages
      WHERE collages.id = collage_settings.collage_id
      AND collages.user_id = auth.uid()
    )
  );

-- Create or replace the function for default settings
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

-- Drop the trigger if it exists before creating it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'create_collage_settings'
  ) THEN
    DROP TRIGGER create_collage_settings ON collages;
  END IF;
END $$;

-- Create the trigger
CREATE TRIGGER create_collage_settings
  AFTER INSERT ON collages
  FOR EACH ROW
  EXECUTE FUNCTION create_default_collage_settings();