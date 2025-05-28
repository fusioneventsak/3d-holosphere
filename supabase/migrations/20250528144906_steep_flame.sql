/*
  # Add photo moderation capabilities

  1. Changes
    - Add RLS policies for photo deletion
    - Ensure only collage owners can delete photos
*/

-- Enable RLS for photos table if not already enabled
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Allow collage owners to delete photos
CREATE POLICY "Users can delete photos from own collages" ON photos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collages
      WHERE collages.id = photos.collage_id
      AND collages.user_id = auth.uid()
    )
  );