-- Add a column for the CPA's saved signature image path.
-- Lets admins one-click approve without redrawing every time.
-- Safe to run multiple times.

alter table public.admin_profile
  add column if not exists signature_image_path text;
