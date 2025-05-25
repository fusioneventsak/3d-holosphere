/*
  # Fix admin user setup

  1. New SQL Migration
     - Ensures admin user exists in both auth.users and public.users tables
     - Properly sets encrypted password
     - Adds admin role to user_roles table
     - Includes better error handling
  
  2. Purpose
     - Fix authentication for admin user (info@fusion-events.ca)
     - Ensure proper database records exist
*/

-- Function to properly set up the admin user with reliable password handling
CREATE OR REPLACE FUNCTION fix_admin_user()
RETURNS void AS $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  admin_user_id uuid;
  does_user_exist boolean;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = admin_email
  ) INTO does_user_exist;

  -- If user doesn't exist, create it from scratch
  IF NOT does_user_exist THEN
    -- Create new user ID
    admin_user_id := gen_random_uuid();
    
    -- Insert into auth.users with proper password encryption
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
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    );
  ELSE
    -- Get existing user ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = admin_email;
    
    -- Reset password for existing user to ensure it works
    UPDATE auth.users 
    SET encrypted_password = crypt(admin_password, gen_salt('bf')),
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = admin_user_id;
  END IF;
  
  -- Ensure user exists in public.users table
  INSERT INTO public.users (id, email)
  VALUES (admin_user_id, admin_email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  
  -- Ensure admin role is assigned
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Admin user setup completed successfully with ID: %', admin_user_id;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT fix_admin_user();

-- Drop the function after execution
DROP FUNCTION fix_admin_user();