/*
  # Fix collage settings RLS policies

  1. Changes
    - Add RLS policy to allow users to manage settings for their own collages
    - Policy uses EXISTS check to verify collage ownership through user_id
    - Covers ALL operations (SELECT, INSERT, UPDATE, DELETE)

  2. Security
    - Only allows access to settings for collages owned by the authenticated user
    - Prevents unauthorized access to or modification of other users' collage settings
    - Uses a join with collages table to verify ownership
*/

-- Create policy for managing collage settings
CREATE POLICY "Allow users to manage their collage settings"
ON "public"."collage_settings"
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM collages 
    WHERE collages.id = collage_settings.collage_id 
    AND collages.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM collages 
    WHERE collages.id = collage_settings.collage_id 
    AND collages.user_id = auth.uid()
  )
);