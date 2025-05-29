-- This migration adds sample stock photos to the database

-- Make sure stock_photos table exists with proper structure
CREATE TABLE IF NOT EXISTS stock_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint if it doesn't exist
ALTER TABLE stock_photos DROP CONSTRAINT IF EXISTS stock_photos_url_key;
ALTER TABLE stock_photos ADD CONSTRAINT stock_photos_url_key UNIQUE (url);

-- Create indexes to improve lookup performance
CREATE INDEX IF NOT EXISTS stock_photos_category_idx ON stock_photos(category);

-- Enable RLS on stock_photos table
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to view stock photos
DROP POLICY IF EXISTS "Anyone can view stock photos" ON stock_photos;
CREATE POLICY "Anyone can view stock photos" ON stock_photos
  FOR SELECT
  TO public
  USING (true);

-- Insert a set of diverse people photos (if they don't already exist)
INSERT INTO stock_photos (url, category)
VALUES
  ('https://images.pexels.com/photos/1839564/pexels-photo-1839564.jpeg', 'people'),
  ('https://images.pexels.com/photos/2896853/pexels-photo-2896853.jpeg', 'people'),
  ('https://images.pexels.com/photos/3876394/pexels-photo-3876394.jpeg', 'people'),
  ('https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg', 'people'),
  ('https://images.pexels.com/photos/3812207/pexels-photo-3812207.jpeg', 'people'),
  ('https://images.pexels.com/photos/6321143/pexels-photo-6321143.jpeg', 'people'),
  ('https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg', 'people'),
  ('https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg', 'people'),
  ('https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg', 'people'),
  ('https://images.pexels.com/photos/1987301/pexels-photo-1987301.jpeg', 'people'),
  ('https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg', 'people'),
  ('https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg', 'people'),
  ('https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg', 'people'),
  ('https://images.pexels.com/photos/5198239/pexels-photo-5198239.jpeg', 'people'),
  ('https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg', 'people'),
  ('https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg', 'people'),
  ('https://images.pexels.com/photos/834863/pexels-photo-834863.jpeg', 'people'),
  ('https://images.pexels.com/photos/3662900/pexels-photo-3662900.jpeg', 'people'),
  ('https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg', 'people'),
  ('https://images.pexels.com/photos/3785424/pexels-photo-3785424.jpeg', 'people')
ON CONFLICT (url) DO NOTHING;

-- Insert some landscape photos too
INSERT INTO stock_photos (url, category)
VALUES
  ('https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg', 'landscape'),
  ('https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg', 'landscape')
ON CONFLICT (url) DO NOTHING;