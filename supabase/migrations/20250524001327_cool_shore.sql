/*
  # Database Schema Update
  
  1. Tables
    - users: Links to auth.users
    - high_scores: For game scores
    - images: For storing image metadata
    - user_roles: For role-based access control
    - settings: Global application settings
    - sound_settings: User sound preferences
    
  2. Security
    - Enables RLS on all tables
    - Adds appropriate policies for each table
    
  3. Performance
    - Adds indexes for frequently accessed columns
    - Includes updated_at triggers
*/

-- Create users table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    email text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile'
  ) THEN
    CREATE POLICY "Users can read own profile"
      ON users FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON users FOR UPDATE
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- Create high scores table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS high_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name text NOT NULL,
    score integer NOT NULL,
    position integer,
    created_at timestamptz DEFAULT now()
  );
  
  ALTER TABLE high_scores ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view high scores'
  ) THEN
    CREATE POLICY "Anyone can view high scores"
      ON high_scores FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert high scores'
  ) THEN
    CREATE POLICY "Anyone can insert high scores"
      ON high_scores FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

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

-- Create trigger for score validation
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_scores_multiples_of_100'
  ) THEN
    CREATE TRIGGER ensure_scores_multiples_of_100
      BEFORE INSERT OR UPDATE ON high_scores
      FOR EACH ROW
      EXECUTE FUNCTION ensure_score_multiples_of_100();
  END IF;
END $$;

-- Create indexes for high scores
CREATE INDEX IF NOT EXISTS high_scores_score_idx ON high_scores(score DESC);
CREATE INDEX IF NOT EXISTS high_scores_position_idx ON high_scores(position);

-- Create images table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    url text NOT NULL,
    alt_text text,
    section text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  
  ALTER TABLE images ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view images'
  ) THEN
    CREATE POLICY "Public can view images"
      ON images FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert images'
  ) THEN
    CREATE POLICY "Authenticated users can insert images"
      ON images FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update images'
  ) THEN
    CREATE POLICY "Authenticated users can update images"
      ON images FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete images'
  ) THEN
    CREATE POLICY "Authenticated users can delete images"
      ON images FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create user_roles table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'user'::text])),
    UNIQUE(user_id, role)
  );
  
  ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own roles'
  ) THEN
    CREATE POLICY "Users can view their own roles"
      ON user_roles FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all user roles'
  ) THEN
    CREATE POLICY "Admins can view all user roles"
      ON user_roles FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
      ));
  END IF;
END $$;

-- Create settings table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_color text DEFAULT '#8b5cf6'::text NOT NULL,
    secondary_color text DEFAULT '#14b8a6'::text NOT NULL,
    logo_url text,
    background_url text,
    grid_size integer DEFAULT 4 NOT NULL,
    gamification_enabled boolean DEFAULT true NOT NULL,
    sponsor_logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  
  ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public users can view settings'
  ) THEN
    CREATE POLICY "Public users can view settings"
      ON settings FOR SELECT
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage settings'
  ) THEN
    CREATE POLICY "Authenticated users can manage settings"
      ON settings
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create sound_settings table
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS sound_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    volume double precision DEFAULT 0.7 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  
  ALTER TABLE sound_settings ENABLE ROW LEVEL SECURITY;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own sound settings'
  ) THEN
    CREATE POLICY "Users can manage their own sound settings"
      ON sound_settings
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Create updated_at column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_images_updated_at'
  ) THEN
    CREATE TRIGGER update_images_updated_at
      BEFORE UPDATE ON images
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_roles_updated_at'
  ) THEN
    CREATE TRIGGER update_user_roles_updated_at
      BEFORE UPDATE ON user_roles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_settings_updated_at
      BEFORE UPDATE ON settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_sound_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_sound_settings_updated_at
      BEFORE UPDATE ON sound_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON user_roles(user_id, role);