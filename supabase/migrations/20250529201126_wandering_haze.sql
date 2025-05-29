/*
  # Remove stock photos table

  This migration removes the stock_photos table and its related indexes/constraints
  since we're no longer using stock photos in the application.
*/

-- Drop the stock_photos table and all its dependencies
DROP TABLE IF EXISTS public.stock_photos CASCADE;