/*
  # Fix authentication user sync

  1. Create trigger for automatic user syncing
    - Creates a trigger on auth.users
    - Automatically creates entries in public.users when auth users are created
    - Ensures users are properly synced between auth and public schemas
  
  2. Fixes existing users
    - Ensures all existing auth users have entries in public.users table
*/

-- Check if the user sync trigger function exists, if not create it
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

-- Sync existing users from auth to public
INSERT INTO public.users (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Set correct permissions for the function
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_created() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_created() TO service_role;