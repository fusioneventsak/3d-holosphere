-- First, remove any duplicate URLs by keeping only the row with the minimum ID
DELETE FROM stock_photos 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY url ORDER BY id) as row_num
    FROM stock_photos
  ) as duplicates
  WHERE row_num > 1
);

-- Now add the unique constraint
ALTER TABLE stock_photos ADD CONSTRAINT stock_photos_url_key UNIQUE (url);

-- Insert stock photos if they don't already exist
INSERT INTO stock_photos (url, category)
SELECT url, 'landscape' AS category
FROM (
  VALUES 
    ('https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg'),
    ('https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg'),
    ('https://images.pexels.com/photos/1366957/pexels-photo-1366957.jpeg'),
    ('https://images.pexels.com/photos/1386604/pexels-photo-1386604.jpeg'),
    ('https://images.pexels.com/photos/1327354/pexels-photo-1327354.jpeg'),
    ('https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg'),
    ('https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg'),
    ('https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg'),
    ('https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg'),
    ('https://images.pexels.com/photos/2325446/pexels-photo-2325446.jpeg'),
    ('https://images.pexels.com/photos/33109/fall-autumn-red-season.jpg'),
    ('https://images.pexels.com/photos/235621/pexels-photo-235621.jpeg'),
    ('https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg'),
    ('https://images.pexels.com/photos/707915/pexels-photo-707915.jpeg'),
    ('https://images.pexels.com/photos/1292115/pexels-photo-1292115.jpeg')
) AS stock_photos(url)
ON CONFLICT (url) DO NOTHING;

-- Make sure we have a policy for viewing stock photos
DROP POLICY IF EXISTS "Anyone can view stock photos" ON stock_photos;
CREATE POLICY "Anyone can view stock photos" ON stock_photos
  FOR SELECT
  TO public
  USING (true);

-- Enable RLS on stock_photos table
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;