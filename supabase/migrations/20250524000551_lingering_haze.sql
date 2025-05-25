/*
  # User Roles and Admin Setup

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `role` (text, either 'admin' or 'user')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_roles` table
    - Add policies for admins and users to view roles
    - Add trigger for updating `updated_at`

  3. Admin Setup
    - Get or create admin user
    - Assign admin role
*/

-- Create the user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
EXCEPTION
  WHEN undefined_object THEN 
    NULL;
END $$;

-- Create policies
CREATE POLICY "Admins can view all user roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  ));

CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_roles_updated_at();

-- Get or create admin user and assign role
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get existing user ID if exists
  SELECT id INTO admin_user_id FROM auth.users 
  WHERE email = 'info@fusion-events.ca';

  -- If user doesn't exist, create new admin user
  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();
    
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
      admin_user_id,
      'authenticated',
      'authenticated',
      'info@fusion-events.ca',
      crypt('fusion3873', gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    );
  END IF;

  -- Add admin role if not exists
  INSERT INTO user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;