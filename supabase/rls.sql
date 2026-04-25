-- Row-Level Security policies for AgFinTax Accredited Certification Tool.
-- Apply after running `npm run db:push`.
-- Usage: paste into Supabase SQL editor, or `psql $DIRECT_DATABASE_URL -f supabase/rls.sql`

-- Helper: returns the app-level role from app_metadata.
create or replace function public.current_role_value()
returns text language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'customer'
  );
$$;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role_value() = 'admin';
$$;

-- ─── user_profile ──────────────────────────────────────────────────────
alter table public.user_profile enable row level security;

drop policy if exists user_profile_self_read on public.user_profile;
create policy user_profile_self_read on public.user_profile
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists user_profile_self_update on public.user_profile;
create policy user_profile_self_update on public.user_profile
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ─── admin_profile ─────────────────────────────────────────────────────
alter table public.admin_profile enable row level security;

drop policy if exists admin_profile_admin_read on public.admin_profile;
create policy admin_profile_admin_read on public.admin_profile
  for select using (public.is_admin());

drop policy if exists admin_profile_self_update on public.admin_profile;
create policy admin_profile_self_update on public.admin_profile
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── submission ────────────────────────────────────────────────────────
alter table public.submission enable row level security;

drop policy if exists submission_customer_read on public.submission;
create policy submission_customer_read on public.submission
  for select using (customer_id = auth.uid() or public.is_admin());

drop policy if exists submission_customer_write on public.submission;
create policy submission_customer_write on public.submission
  for insert with check (customer_id = auth.uid());

drop policy if exists submission_customer_update on public.submission;
create policy submission_customer_update on public.submission
  for update using (
    (customer_id = auth.uid() and status in ('draft', 'changes_requested'))
    or public.is_admin()
  );

-- ─── document ──────────────────────────────────────────────────────────
alter table public.document enable row level security;

drop policy if exists document_read on public.document;
create policy document_read on public.document
  for select using (
    exists (
      select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists document_customer_insert on public.document;
create policy document_customer_insert on public.document
  for insert with check (
    exists (
      select 1 from public.submission s
      where s.id = submission_id and s.customer_id = auth.uid()
    )
  );

-- ─── extracted_field / rule_evaluation / review_decision ───────────────
alter table public.extracted_field enable row level security;
drop policy if exists ef_read on public.extracted_field;
create policy ef_read on public.extracted_field
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );
drop policy if exists ef_admin_write on public.extracted_field;
create policy ef_admin_write on public.extracted_field
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.rule_evaluation enable row level security;
drop policy if exists re_read on public.rule_evaluation;
create policy re_read on public.rule_evaluation
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );

alter table public.review_decision enable row level security;
drop policy if exists rd_read on public.review_decision;
create policy rd_read on public.review_decision
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );
drop policy if exists rd_admin_write on public.review_decision;
create policy rd_admin_write on public.review_decision
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── net_worth_line_item / primary_residence_info ──────────────────────
alter table public.net_worth_line_item enable row level security;
drop policy if exists nw_read on public.net_worth_line_item;
create policy nw_read on public.net_worth_line_item
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );
drop policy if exists nw_admin_write on public.net_worth_line_item;
create policy nw_admin_write on public.net_worth_line_item
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.primary_residence_info enable row level security;
drop policy if exists pr_read on public.primary_residence_info;
create policy pr_read on public.primary_residence_info
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );
drop policy if exists pr_customer_write on public.primary_residence_info;
create policy pr_customer_write on public.primary_residence_info
  for all using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() and s.status in ('draft', 'changes_requested')))
    or public.is_admin()
  );

-- ─── certificate ───────────────────────────────────────────────────────
alter table public.certificate enable row level security;
drop policy if exists cert_read on public.certificate;
create policy cert_read on public.certificate
  for select using (
    exists (select 1 from public.submission s
      where s.id = submission_id
        and (s.customer_id = auth.uid() or public.is_admin()))
  );
drop policy if exists cert_admin_write on public.certificate;
create policy cert_admin_write on public.certificate
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── notification ──────────────────────────────────────────────────────
alter table public.notification enable row level security;
drop policy if exists notif_self on public.notification;
create policy notif_self on public.notification
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists notif_self_update on public.notification;
create policy notif_self_update on public.notification
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── audit_log (admin-read only; writes via service role) ──────────────
alter table public.audit_log enable row level security;
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin());

-- ─── job (service-role only — no RLS policies grant access) ────────────
alter table public.job enable row level security;

-- ─── Storage RLS: `accreditation-docs` bucket ─────────────────────────
-- Path layout: submissions/{submissionId}/docs/{filename}
--              certificates/{submissionId}/{certNumber}.(pdf|docx)
--              certificates/{submissionId}/signatures/{certNumber}.png

-- Insert: only by authenticated users who own the submission (draft/changes_requested)
drop policy if exists accreditation_docs_insert on storage.objects;
create policy accreditation_docs_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'accreditation-docs'
    and (storage.foldername(name))[1] = 'submissions'
    and exists (
      select 1 from public.submission s
      where s.id::text = (storage.foldername(name))[2]
        and s.customer_id = auth.uid()
        and s.status in ('draft', 'changes_requested')
    )
  );

-- Select: customer can read their own docs; admin can read anything in the bucket
drop policy if exists accreditation_docs_select on storage.objects;
create policy accreditation_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'accreditation-docs'
    and (
      public.is_admin()
      or exists (
        select 1 from public.submission s
        where s.id::text = (storage.foldername(name))[2]
          and s.customer_id = auth.uid()
      )
    )
  );

-- Delete: customer can delete their own docs while editable
drop policy if exists accreditation_docs_delete on storage.objects;
create policy accreditation_docs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'accreditation-docs'
    and exists (
      select 1 from public.submission s
      where s.id::text = (storage.foldername(name))[2]
        and s.customer_id = auth.uid()
        and s.status in ('draft', 'changes_requested')
    )
  );

-- ─── Auto-sync user_profile with auth.users ────────────────────────────
-- Creates a user_profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profile (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_app_meta_data ->> 'role', 'customer')::public.user_role
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.user_profile.full_name),
        role = excluded.role,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data, raw_app_meta_data
  on auth.users
  for each row execute function public.handle_new_user();
