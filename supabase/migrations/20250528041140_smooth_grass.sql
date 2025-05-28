/*
  # Fix collage settings RLS policies

  1. Changes
    - Update RLS policies for collage_settings table to:
      - Allow public access to view settings for any collage (needed for anonymous viewers)
      - Allow authenticated users to manage settings for collages they own
      
  2. Security
    - Maintains RLS protection while enabling proper access patterns
    - Public can only read settings
    - Owners retain full CRUD control
*/

-- Drop existing policies to recreate them with correct permissions
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;

-- Allow anyone to view collage settings (needed for anonymous viewers)
CREATE POLICY "Anyone can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to manage settings for their own collages
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