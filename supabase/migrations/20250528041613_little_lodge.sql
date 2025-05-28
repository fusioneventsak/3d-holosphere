/*
  # Fix collage settings RLS policies

  1. Changes
    - Add RLS policy to allow users to select collage settings for collages they own
    - Add RLS policy to allow public access to collage settings for viewing collages
    - Ensure policies are properly scoped to prevent unauthorized access

  2. Security
    - Enable RLS on collage_settings table (if not already enabled)
    - Add policy for authenticated users to manage their own collage settings
    - Add policy for public users to view collage settings
*/

-- Enable RLS (if not already enabled)
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage own collage settings" ON collage_settings;

-- Allow public to view collage settings (needed for viewing collages)
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

-- Allow authenticated users to manage their own collage settings
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