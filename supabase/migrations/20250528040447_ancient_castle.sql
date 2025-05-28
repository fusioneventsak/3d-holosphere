/*
  # Add collage settings table
  
  1. New Tables
    - `collage_settings`: Stores per-collage scene settings
      - `id` (uuid, primary key)
      - `collage_id` (uuid, references collages)
      - `settings` (jsonb, stores scene configuration)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `collage_settings` table
    - Add policies for authenticated users to manage their collage settings
*/

-- Create collage_settings table
CREATE TABLE IF NOT EXISTS collage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collage_id uuid NOT NULL REFERENCES collages(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_collage_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_collage_settings_updated_at
  BEFORE UPDATE ON collage_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_collage_settings_updated_at();

-- Enable RLS
ALTER TABLE collage_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
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

-- Create index for faster lookups
CREATE INDEX collage_settings_collage_id_idx ON collage_settings(collage_id);