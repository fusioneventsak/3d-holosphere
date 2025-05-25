/*
  # Fix User Synchronization
  
  1. Ensures proper synchronization between auth.users and public.users
  2. Fixes admin user role assignment
  3. Adds missing public.users entries
*/

-- First ensure the admin user exists in public.users
INSERT INTO public.users (id, email)
SELECT '14562854-7aec-4a18-b46b-72934d13a633', 'info@fusion-events.ca'
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Ensure admin role is assigned
INSERT INTO public.user_roles (user_id, role)
VALUES ('14562854-7aec-4a18-b46b-72934d13a633', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Create trigger function to keep tables in sync
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

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS sync_users ON auth.users;
CREATE TRIGGER sync_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_users();

-- Sync any missing users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;