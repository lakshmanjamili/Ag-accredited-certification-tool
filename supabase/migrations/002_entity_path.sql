-- Add entity_assets as a new verification path (Rule 501(a)(7) / (9))
-- for entity investors (corporations, trusts, LLCs, funds, nonprofits)
-- with total assets >= $5,000,000.
--
-- Apply after schema.ts update. Run via Supabase SQL editor OR:
--   npm run db:migrate-entity
--
-- Safe to run multiple times — checks if value already exists.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.verification_path'::regtype
      and enumlabel = 'entity_assets'
  ) then
    alter type public.verification_path add value 'entity_assets';
  end if;
end $$;
