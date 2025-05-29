-- This migration updates the stock_photos table to add photos from Supabase Storage

-- Make sure stock_photos table exists
CREATE TABLE IF NOT EXISTS stock_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint if it doesn't exist
ALTER TABLE stock_photos DROP CONSTRAINT IF EXISTS stock_photos_url_key;
ALTER TABLE stock_photos ADD CONSTRAINT stock_photos_url_key UNIQUE (url);

-- Clear existing stock photos to replace with our new ones
DELETE FROM stock_photos;

-- Create index to improve lookup performance
CREATE INDEX IF NOT EXISTS stock_photos_category_idx ON stock_photos(category);

-- Enable RLS on stock_photos table
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;

-- Make sure we have a policy for viewing stock photos
DROP POLICY IF EXISTS "Anyone can view stock photos" ON stock_photos;
CREATE POLICY "Anyone can view stock photos" ON stock_photos
  FOR SELECT
  TO public
  USING (true);