/*
  # Allow public access to collage settings

  1. Changes
    - Drop existing RLS policies for collage_settings table
    - Create new policy allowing unconditional public SELECT access
    - Maintain existing policy for authenticated users to manage their own settings

  2. Security
    - Anyone can view any collage settings without restrictions
    - Only authenticated collage owners can modify their settings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage own collage settings" ON collage_settings;

-- Create new policies
CREATE POLICY "Public can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (true);

CREATE POLICY "Users can manage own collage settings"
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