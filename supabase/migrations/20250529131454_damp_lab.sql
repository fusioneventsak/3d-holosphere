-- This migration adds additional public policies to ensure anyone can manage collage settings
-- and fixes issues with animation patterns and settings

-- Make sure RLS is enabled on collage_settings
ALTER TABLE IF EXISTS collage_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Anyone can view collage settings" ON collage_settings;
DROP POLICY IF EXISTS "Anyone can manage collage settings" ON collage_settings;

-- Create comprehensive policies for public access to collage settings
CREATE POLICY "Anyone can view collage settings" ON collage_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can manage collage settings" ON collage_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Also ensure public access to collages table
DROP POLICY IF EXISTS "Anyone can view collages" ON collages;
CREATE POLICY "Anyone can view collages" ON collages
  FOR SELECT
  TO public
  USING (true);

-- Create trigger function to update timestamp on collage_settings
CREATE OR REPLACE FUNCTION update_collage_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for updating timestamp
DROP TRIGGER IF EXISTS update_collage_settings_updated_at ON collage_settings;
CREATE TRIGGER update_collage_settings_updated_at
  BEFORE UPDATE ON collage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_collage_settings_updated_at();