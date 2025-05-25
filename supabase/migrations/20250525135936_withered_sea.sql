/*
  # Add Stock Photos Table
  
  1. New Table
    - `stock_photos`
      - `id` (uuid, primary key)
      - `url` (text, not null)
      - `category` (text, not null)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS
    - Add policy for public viewing
*/

CREATE TABLE IF NOT EXISTS public.stock_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE stock_photos ENABLE ROW LEVEL SECURITY;

-- Create policy for public viewing
CREATE POLICY "Anyone can view stock photos"
  ON stock_photos FOR SELECT
  TO public
  USING (true);

-- Insert initial stock headshots
INSERT INTO stock_photos (url, category) VALUES
  -- Asian
  ('https://images.pexels.com/photos/1820919/pexels-photo-1820919.jpeg', 'asian'),
  ('https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg', 'asian'),
  ('https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg', 'asian'),
  ('https://images.pexels.com/photos/1308881/pexels-photo-1308881.jpeg', 'asian'),

  -- Black
  ('https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg', 'black'),
  ('https://images.pexels.com/photos/935965/pexels-photo-935965.jpeg', 'black'),
  ('https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg', 'black'),
  ('https://images.pexels.com/photos/1729931/pexels-photo-1729931.jpeg', 'black'),

  -- Hispanic
  ('https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg', 'hispanic'),
  ('https://images.pexels.com/photos/1081188/pexels-photo-1081188.jpeg', 'hispanic'),
  ('https://images.pexels.com/photos/1578850/pexels-photo-1578850.jpeg', 'hispanic'),
  ('https://images.pexels.com/photos/1729931/pexels-photo-1729931.jpeg', 'hispanic'),

  -- White
  ('https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg', 'white'),
  ('https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg', 'white'),
  ('https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg', 'white'),
  ('https://images.pexels.com/photos/2050994/pexels-photo-2050994.jpeg', 'white'),

  -- Middle Eastern
  ('https://images.pexels.com/photos/1082962/pexels-photo-1082962.jpeg', 'middle_eastern'),
  ('https://images.pexels.com/photos/1270076/pexels-photo-1270076.jpeg', 'middle_eastern'),
  ('https://images.pexels.com/photos/1668928/pexels-photo-1668928.jpeg', 'middle_eastern'),
  ('https://images.pexels.com/photos/1729931/pexels-photo-1729931.jpeg', 'middle_eastern');