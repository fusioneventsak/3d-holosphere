/*
  # Fix Authentication System
  
  1. Fixes
    - Correct implementation of auth triggers
    - Better error handling in user syncing
    - Proper schema access control

  2. Changes
    - Recreate triggers with proper permissions
    - Ensure proper synchronization between auth.users and public.users
    - Fix role handling and profile creation
*/

-- First, drop any existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_created();
DROP FUNCTION IF EXISTS public.handle_auth_user_updated();

-- Create a robust function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the user into the public schema
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, now()))
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  
  -- Also insert default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user updates
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers with proper timing and conditions
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

CREATE TRIGGER on_auth_user_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.handle_auth_user_updated();

-- Ensure all auth users are synced to public schema
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

-- Set proper permissions for the functions
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_updated() TO service_role;

-- Enhance user table security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies with improved logic
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

-- Create policy for inserting user profiles
DROP POLICY IF EXISTS "Auth can insert user profiles" ON users;
CREATE POLICY "Auth can insert user profiles"
  ON users FOR INSERT
  TO service_role
  WITH CHECK (true);