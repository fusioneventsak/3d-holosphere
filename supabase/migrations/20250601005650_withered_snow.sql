-- Enable RLS
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;

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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_collage_settings ON collages;
DROP FUNCTION IF EXISTS create_default_collage_settings();

-- Create trigger to automatically create settings for new collages
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
      "photoSize": 4.0,
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
      "animationSpeed": 50,
      "cameraDistance": 25,
      "emptySlotColor": "#1A1A1A",
      "floorMetalness": 0.4,
      "floorRoughness": 0.5,
      "spotlightAngle": 0.7853981633974483,
      "spotlightColor": "#ffffff",
      "spotlightCount": 4,
      "spotlightWidth": 0.6,
      "backgroundColor": "#000000",
      "gridAspectRatio": 1.77778,
      "spotlightHeight": 30,
      "animationEnabled": true,
      "animationPattern": "grid",
      "floorReflectivity": 0.6,
      "spotlightDistance": 40,
      "spotlightPenumbra": 0.4,
      "backgroundGradient": false,
      "spotlightIntensity": 100.0,
      "cameraRotationSpeed": 0.2,
      "ambientLightIntensity": 0.2,
      "backgroundGradientEnd": "#1a1a1a",
      "cameraRotationEnabled": true,
      "backgroundGradientAngle": 180,
      "backgroundGradientStart": "#000000"
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_collage_settings
  AFTER INSERT ON collages
  FOR EACH ROW
  EXECUTE FUNCTION create_default_collage_settings();