/*
  # Clean up and fix collage settings RLS policies
  
  This migration:
  1. Drops all existing policies on collage_settings
  2. Re-enables RLS
  3. Creates two clear policies:
     - One for authenticated users to manage their own settings
     - One for public viewing
*/

-- First, drop ALL existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can manage their collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage their own collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Allow users to manage their collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Public can view collage settings" ON collage_settings;

-- Re-enable RLS
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Create a single comprehensive policy for authenticated users
CREATE POLICY "manage_own_collage_settings"
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

-- Create a simple policy for public viewing
CREATE POLICY "view_collage_settings"
ON collage_settings
FOR SELECT
TO public
USING (true);