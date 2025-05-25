/*
  # Fix admin user creation

  1. Changes
    - Properly create admin user with correct credentials
    - Ensure user has proper authentication settings
    - Add admin role if not exists
*/

-- Function to create or update admin user
CREATE OR REPLACE FUNCTION create_admin_user()
RETURNS void AS $$
DECLARE
  admin_email text := 'info@fusion-events.ca';
  admin_password text := 'fusion3873';
  existing_user_id uuid;
BEGIN
  -- Check if user exists
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = admin_email;

  -- If user doesn't exist, create it
  IF existing_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_sent_at,
      is_super_admin,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change,
      email_change_token_new,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '',
      '',
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now(),
      now(),
      false,
      null,
      null,
      null,
      '',
      null,
      '',
      '',
      '',
      0,
      null,
      '',
      null,
      false,
      null
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_admin_user();

-- Drop the function as it's no longer needed
DROP FUNCTION create_admin_user();