/*
  # Fix User Authentication and Policies
  
  1. Changes
    - Drop existing policies before recreating
    - Ensure tables exist with proper structure
    - Set up admin user and roles
    - Create sync trigger for auth users
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS sync_users ON auth.users;
DROP FUNCTION IF EXISTS public.sync_users();

-- Recreate tables
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Ensure admin user exists in public.users
INSERT INTO public.users (id, email)
VALUES ('14562854-7aec-4a18-b46b-72934d13a633', 'info@fusion-events.ca')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Ensure admin role exists
INSERT INTO public.user_roles (user_id, role)
VALUES ('14562854-7aec-4a18-b46b-72934d13a633', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create sync function
CREATE OR REPLACE FUNCTION public.sync_users()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER sync_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_users();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;