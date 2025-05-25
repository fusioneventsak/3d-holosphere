/*
  # Add high scores functionality
  
  1. New Tables
    - `high_scores`
      - `id` (uuid, primary key)
      - `player_name` (text, not null)
      - `score` (integer, not null)
      - `position` (integer)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on high_scores table
    - Add policies for public viewing and insertion
  
  3. Validation
    - Add trigger to ensure scores are multiples of 100
*/

-- Create high_scores table
CREATE TABLE IF NOT EXISTS high_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  score integer NOT NULL,
  position integer,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view high scores" ON high_scores;
  DROP POLICY IF EXISTS "Anyone can insert high scores" ON high_scores;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Anyone can view high scores"
  ON high_scores FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert high scores"
  ON high_scores FOR INSERT
  TO public
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS high_scores_score_idx ON high_scores(score DESC);
CREATE INDEX IF NOT EXISTS high_scores_position_idx ON high_scores(position);

-- Create function to ensure scores are multiples of 100
CREATE OR REPLACE FUNCTION ensure_score_multiples_of_100()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.score % 100 != 0 THEN
    RAISE EXCEPTION 'Score must be a multiple of 100';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_scores_multiples_of_100 ON high_scores;
CREATE TRIGGER ensure_scores_multiples_of_100
  BEFORE INSERT OR UPDATE ON high_scores
  FOR EACH ROW
  EXECUTE FUNCTION ensure_score_multiples_of_100();