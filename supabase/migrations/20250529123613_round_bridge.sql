/*
  # Fix RLS policies for collage settings

  1. Changes
    - Enable RLS on collage_settings table
    - Add RLS policies for collage settings:
      - Allow users to manage settings for their own collages
      - Allow public to view collage settings

  2. Security
    - Enable RLS on collage_settings table
    - Add policies to ensure users can only modify settings for collages they own
    - Allow public read access to all collage settings
*/

-- Enable RLS
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;

-- Create policy for managing settings (INSERT, UPDATE, DELETE)
CREATE POLICY "Users can manage their collage settings"
ON collage_settings
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

-- Create policy for public viewing
CREATE POLICY "Anyone can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (true);