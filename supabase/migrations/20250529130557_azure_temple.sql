-- This migration adds a public policy to allow anyone to manage collage settings
-- without requiring authentication

-- Check if the policy exists and drop it if it does
DROP POLICY IF EXISTS "Anyone can manage collage settings" ON collage_settings;

-- Create the policy to allow anyone to manage collage settings
CREATE POLICY "Anyone can manage collage settings" ON collage_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Make sure we also have a policy for anyone to view collage settings
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
CREATE POLICY "Anyone can view collage settings" ON collage_settings
  FOR SELECT
  TO public
  USING (true);

-- Create indexes to improve performance of queries
CREATE INDEX IF NOT EXISTS idx_collage_settings_collage_id ON collage_settings(collage_id);