/*
  # Allow public access to collage settings

  This migration removes authentication requirements and enables public access to all operations on the collage_settings table.

  1. Changes
    - Drop existing RLS policies
    - Create new policy allowing all operations for public access
    - Keep RLS enabled but make it permissive

  Note: This is for development/testing only and should be replaced with proper authentication before production use.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Users can manage own collage settings" ON collage_settings;

-- Create new permissive policy allowing all operations
CREATE POLICY "Allow all operations on collage settings"
ON collage_settings
FOR ALL 
TO public
USING (true)
WITH CHECK (true);