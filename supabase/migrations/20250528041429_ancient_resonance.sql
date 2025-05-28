/*
  # Fix RLS policies for collage settings

  1. Changes
    - Update RLS policies for collage_settings table to properly handle permissions
    - Allow users to read settings for collages they own
    - Allow public access to view collage settings for display purposes
    
  2. Security
    - Enable RLS on collage_settings table
    - Add policy for authenticated users to manage their own collage settings
    - Add policy for public to view collage settings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;

-- Create new policies
CREATE POLICY "Public can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM collages 
    WHERE collages.id = collage_settings.collage_id
  )
);

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