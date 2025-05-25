/*
  # Fix Authentication System

  1. Changes
    - Properly handle function and trigger dependencies
    - Set up users and user_roles tables
    - Create admin user with fixed credentials
    - Add proper RLS policies
*/

-- Drop existing triggers and functions with CASCADE
DROP FUNCTION IF EXISTS public.sync_users() CASCADE;

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create user_roles table if not exists
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

-- Create sync function with better error handling
CREATE OR REPLACE FUNCTION public.sync_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user in public schema
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  -- Add default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in sync_users: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER sync_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_users();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

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

-- Create admin user with fixed UUID
DO $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  admin_user_id uuid := '14562854-7aec-4a18-b46b-72934d13a633';
BEGIN
  -- Create admin user in auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_user_id) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now(),
      '',
      ''
    );
  ELSE
    -- Update existing admin user's password
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = admin_user_id;
  END IF;

  -- Ensure admin exists in public.users
  INSERT INTO public.users (id, email)
  VALUES (admin_user_id, admin_email)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  -- Ensure admin role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;