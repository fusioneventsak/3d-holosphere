/*
  # Allow anonymous access to collages and settings
  
  1. Changes
    - Update RLS policies to allow anonymous access to collages and settings
    - Remove authentication requirements for viewing collages
    - Ensure settings are accessible without authentication
  
  2. Security
    - Maintains write protection (only authenticated users can modify)
    - Read-only access for anonymous users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view collages by code" ON collages;
DROP POLICY IF EXISTS "Anyone can view photos" ON photos;
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;

-- Allow anyone to view collages
CREATE POLICY "Anyone can view collages"
ON collages
FOR SELECT
TO public
USING (true);

-- Allow anyone to view photos
CREATE POLICY "Anyone can view photos"
ON photos
FOR SELECT
TO public
USING (true);

-- Allow anyone to view collage settings
CREATE POLICY "Anyone can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (true);