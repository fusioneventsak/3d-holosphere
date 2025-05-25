/*
  # Fix collages table to allow anonymous creation
  
  1. Changes
    - Make user_id nullable
    - Update RLS policies to allow public access
    - Add indexes for better performance
*/

-- Modify collages table to make user_id nullable
ALTER TABLE public.collages
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create collages" ON collages;
DROP POLICY IF EXISTS "Anyone can view collages" ON collages;
DROP POLICY IF EXISTS "Users can update own collages" ON collages;
DROP POLICY IF EXISTS "Users can delete own collages" ON collages;

-- Create more permissive policies
CREATE POLICY "Anyone can create collages"
  ON collages FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can view collages"
  ON collages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update collages"
  ON collages FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can delete collages"
  ON collages FOR DELETE
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS collages_code_idx ON collages(code);
CREATE INDEX IF NOT EXISTS collages_user_id_idx ON collages(user_id);