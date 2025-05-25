/*
  # Fix admin user creation and ensure proper authentication
  
  1. Creates admin user with provided credentials if not exists
  2. Ensures all necessary tables for auth are properly linked
*/

-- Function to create or update admin user with proper error handling
CREATE OR REPLACE FUNCTION ensure_admin_user()
RETURNS void AS $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  admin_user_id uuid;
BEGIN
  -- Check if user exists
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = admin_email;

  -- If user doesn't exist, create it
  IF admin_user_id IS NULL THEN
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

    -- Also create entry in public.users
    INSERT INTO public.users (id, email)
    VALUES (admin_user_id, admin_email)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Ensure user has admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT ensure_admin_user();

-- Drop the function as it's no longer needed
DROP FUNCTION ensure_admin_user();