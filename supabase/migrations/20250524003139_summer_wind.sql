/*
  # Fix Authentication Issues
  
  1. Changes
    - Recreate user trigger functions with better error handling
    - Fix RLS policies for user tables
    - Ensure proper user synchronization between auth.users and public.users
    - Add function to validate database schema integrity
  
  2. Security
    - Ensure proper permissions for database functions
    - Apply appropriate RLS policies for authentication tables
*/

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_created();
DROP FUNCTION IF EXISTS public.handle_auth_user_updated();

-- Create robust user synchronization function with error handling
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user in public schema with explicit error handling
  BEGIN
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, now()))
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error syncing auth user to public schema: %', SQLERRM;
  END;
  
  -- Ensure user has the basic 'user' role
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error assigning user role: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user in public schema with error handling
  BEGIN
    UPDATE public.users
    SET email = NEW.email
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error updating user in public schema: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers with proper timing
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.handle_auth_user_updated();

-- Fix any existing users that may be out of sync
DO $$
BEGIN
  -- Sync auth users to public schema
  INSERT INTO public.users (id, email, created_at)
  SELECT id, email, created_at
  FROM auth.users
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  
  -- Ensure all users have the basic user role
  INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'user'
  FROM auth.users
  ON CONFLICT (user_id, role) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error syncing existing users: %', SQLERRM;
END
$$;

-- Set proper function permissions
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_updated() TO service_role;

-- Verify and update RLS policies
DO $$
BEGIN
  -- Enable RLS on users table if not already enabled
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$$;

-- Drop and recreate user policies with better permissions
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Auth can insert user profiles" ON users;
CREATE POLICY "Auth can insert user profiles"
  ON users FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create database schema validation function
CREATE OR REPLACE FUNCTION validate_schema_integrity()
RETURNS TABLE (
  table_name text,
  status text,
  issue text
) AS $$
DECLARE
  required_tables text[] := ARRAY['users', 'user_roles', 'collages', 'photos'];
  t text;
BEGIN
  -- Check required tables exist
  FOREACH t IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      table_name := t;
      status := 'MISSING';
      issue := 'Table does not exist';
      RETURN NEXT;
    ELSE
      table_name := t;
      status := 'OK';
      issue := NULL;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- Check RLS is enabled on all tables
  FOREACH t IN ARRAY required_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t AND rowsecurity = true
    ) THEN
      table_name := t;
      status := 'WARNING';
      issue := 'Row Level Security not enabled';
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- Specific check for users table
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    -- Check for required columns
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    ) THEN
      table_name := 'users';
      status := 'ERROR';
      issue := 'Missing id column';
      RETURN NEXT;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email'
    ) THEN
      table_name := 'users';
      status := 'ERROR';
      issue := 'Missing email column';
      RETURN NEXT;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION validate_schema_integrity() TO service_role;

-- Create admin user if it doesn't exist
DO $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  admin_id uuid;
BEGIN
  -- Check if admin user exists
  SELECT id INTO admin_id FROM auth.users WHERE email = admin_email;
  
  -- Create admin user if not exists
  IF admin_id IS NULL THEN
    -- Create admin user in auth schema
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
    RETURNING id INTO admin_id;
    
    -- Create admin user in public schema
    INSERT INTO public.users (id, email, created_at)
    VALUES (admin_id, admin_email, now())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END
$$;