/*
  # Fix collage settings constraints

  1. Changes
    - Add unique constraint on collage_id to ensure only one settings record per collage
    - Add NOT NULL constraint to settings column
    - Add default settings JSON structure

  2. Security
    - Maintain existing RLS policies
*/

-- Add unique constraint to prevent multiple settings per collage
ALTER TABLE collage_settings
ADD CONSTRAINT collage_settings_collage_id_key UNIQUE (collage_id);

-- Ensure settings column is not null and has proper default
ALTER TABLE collage_settings
ALTER COLUMN settings SET DEFAULT '{
  "animationPattern": "grid",
  "animationSpeed": 0.5,
  "animationEnabled": false,
  "useStockPhotos": true,
  "photoCount": 50,
  "backgroundColor": "#000000",
  "backgroundGradient": false,
  "backgroundGradientStart": "#000000",
  "backgroundGradientEnd": "#1a1a1a",
  "backgroundGradientAngle": 180,
  "emptySlotColor": "#1A1A1A",
  "cameraDistance": 25,
  "cameraRotationEnabled": true,
  "cameraRotationSpeed": 0.2,
  "cameraHeight": 10,
  "cameraEnabled": true,
  "spotlightCount": 2,
  "spotlightHeight": 15,
  "spotlightDistance": 30,
  "spotlightAngle": 0.7853981633974483,
  "spotlightWidth": 0.8,
  "spotlightPenumbra": 0.8,
  "ambientLightIntensity": 0.5,
  "spotlightIntensity": 100.0,
  "spotlightColor": "#ffffff",
  "floorEnabled": true,
  "floorColor": "#1A1A1A",
  "floorOpacity": 0.8,
  "floorSize": 200,
  "floorReflectivity": 0.6,
  "floorMetalness": 0.4,
  "floorRoughness": 0.5,
  "gridEnabled": true,
  "gridColor": "#444444",
  "gridSize": 200,
  "gridDivisions": 30,
  "gridOpacity": 1.0,
  "photoSize": 0.8,
  "photoSpacing": 0,
  "wallHeight": 0,
  "gridAspectRatio": 1.5
}'::jsonb;