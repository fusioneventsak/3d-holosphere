/*
  # Fix User and Role Tables

  1. Changes
    - Drop and recreate users and roles tables
    - Add proper RLS policies
    - Create admin user only if it doesn't exist
    
  2. Security
    - Enable RLS on all tables
    - Add appropriate policies
*/

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
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

-- Create admin user if it doesn't exist
DO $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  admin_user_id uuid;
BEGIN
  -- Check if admin user exists
  SELECT id INTO admin_user_id FROM auth.users WHERE email = admin_email;
  
  -- Only create if user doesn't exist
  IF admin_user_id IS NULL THEN
    -- Create admin user in auth.users
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
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    )
    RETURNING id INTO admin_user_id;

    -- Create admin profile in public.users
    INSERT INTO public.users (id, email)
    VALUES (admin_user_id, admin_email);

    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin');
  END IF;
END $$;