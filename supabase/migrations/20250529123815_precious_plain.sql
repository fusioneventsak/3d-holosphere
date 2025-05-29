/*
  # Fix RLS policies for collage settings

  1. Changes
    - Update RLS policies for collage_settings table to properly handle user permissions
    - Add policies for INSERT, UPDATE, and SELECT operations
    - Ensure users can only modify settings for collages they own
    - Keep existing public SELECT access for viewing collages

  2. Security
    - Enable RLS on collage_settings table (already enabled)
    - Add policy for authenticated users to manage their collage settings
    - Add policy for public users to view collage settings
    - Link permissions to collage ownership through user_id
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow users to manage their collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;

-- Create new policies with proper conditions
CREATE POLICY "Users can manage their own collage settings"
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

-- Allow public viewing of collage settings
CREATE POLICY "Anyone can view collage settings"
ON collage_settings
FOR SELECT
TO public
USING (true);