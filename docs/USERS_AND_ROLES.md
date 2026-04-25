# Users, Roles, and Admin Management

How AgFinTax Certification Tool handles identity, access, and user onboarding. This is the architecture reference — start here if you're adding a new role-gated feature, changing the invite flow, or debugging access problems.

---

## TL;DR

- **One source of truth:** `auth.users.app_metadata.role` (values: `customer` | `admin`).
- **Tamper-proof:** `app_metadata` is only writable by the service-role key. The browser JWT can read it but can't change it.
- **Auto-mirrored:** a Postgres trigger copies `role` into `public.user_profile.role` whenever auth.users changes, so SQL queries can filter by role without calling the auth API.
- **Defense-in-depth:** 4 gates (middleware → server-component guard → server action → RLS policy) — any one of them would stop a role leak on its own.
- **Email-driven onboarding:** admins invite users from `/admin/users`. Supabase sends the branded email. Invitee clicks the link, sets a password, lands in the right workspace.
- **Three management paths, one API:** web UI, CLI scripts, Supabase dashboard — all write to the same `app_metadata.role` field.

---

## 1. The role model

### Where role lives

| Field | Who can write | Exposed in JWT | Our use |
|---|---|---|---|
| `auth.users.user_metadata` | user themselves | yes | `full_name`, `phone` (low-trust, for display) |
| **`auth.users.app_metadata`** | **only service-role key** | **yes** | **`role: 'customer' \| 'admin'`** |

A logged-in user cannot promote themselves to admin via the REST API, the JS client, or any browser call. Only code running with `SUPABASE_SERVICE_ROLE_KEY` (server-only) can set it. That key never leaves the server.

### Synced layers

```
auth.users.app_metadata.role         ← source of truth (Supabase owns this)
         ↓  trigger on_auth_user_created
public.user_profile.role             ← mirrored for app SQL + RLS
         ↓  embedded on every sign-in
JWT app_metadata.role                ← read by middleware + RLS + server actions
```

All three stay in sync because the trigger fires on every insert/update to `auth.users`. App code **never writes to `user_profile.role` directly** — it's a read-only mirror.

### The trigger (`supabase/rls.sql`)

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profile (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_app_meta_data ->> 'role', 'customer')::public.user_role
  )
  on conflict (id) do update
    set role = excluded.role,
        email = excluded.email,
        full_name = coalesce(excluded.full_name, public.user_profile.full_name),
        updated_at = now();
  return new;
end $$;

create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data, raw_app_meta_data
  on auth.users for each row execute function public.handle_new_user();
```

### Why not a separate `admins` table?

1. **Zero-query gating.** The JWT already carries the role. RLS policies + middleware read it directly — no join, no second DB call.
2. **No drift risk.** With two tables you can end up in states like "admin in the admins table but customer in user_profile" — we'd then argue about which is right.
3. **Unified flow.** Promoting someone is one API call. Checking someone is one boolean. Auditing is one log entry.

---

## 2. The four gates

Every request that touches admin data passes through four independent checks. Removing any three of them still leaves the data safe.

### Gate 1 — Proxy / middleware (first response-time check)

`src/proxy.ts` → `src/lib/supabase/middleware.ts`:

```ts
if (user && pathname.startsWith('/admin/')) {
  const role = (user.app_metadata as { role?: string })?.role
  if (role !== 'admin') return NextResponse.redirect('/dashboard')
}
```

Runs before server components render. Fastest redirect — the user never sees the admin page shell.

### Gate 2 — Server-component guard (in the page)

`src/lib/auth.ts`:

```ts
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/dashboard')
  return user
}
```

Every admin page starts with `const admin = await requireAdmin()`. Defense-in-depth: even if the middleware was bypassed (e.g., a misrouted request), the page still redirects.

### Gate 3 — Server action (on every mutation)

Every server action that writes to admin-only tables calls `requireAdmin()` first:

```ts
export async function decisionAction(formData: FormData) {
  const admin = await requireAdmin()
  // ... only after this line do we trust that caller is admin
}
```

### Gate 4 — Row-Level Security (`supabase/rls.sql`)

RLS runs at the Postgres level. Even if an attacker bypassed our whole app and hit Supabase with their own JWT, Postgres would reject the query.

```sql
create function public.is_admin() returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    'customer'
  ) = 'admin';
$$;

create policy submission_customer_read on public.submission
  for select using (customer_id = auth.uid() or public.is_admin());

create policy ef_admin_write on public.extracted_field
  for all using (public.is_admin()) with check (public.is_admin());
```

Every table in `public.*` has policies that use `is_admin()` or `auth.uid()`.

---

## 3. The `/admin/users` feature

Operator UI for managing everyone who can access AgFinTax. Built as 4 files:

| File | Purpose |
|---|---|
| `src/app/admin/users/page.tsx` | Server component — queries `user_profile`, enriches with `supabase.auth.admin.listUsers()` for auth status, groups into admins vs customers |
| `src/app/admin/users/invite-form.tsx` | Client component — controlled name + email + role pill selector |
| `src/app/admin/users/role-control.tsx` | Client component — per-row Resend / Promote / Demote / Deactivate buttons |
| `src/app/admin/users/actions.ts` | 4 server actions, each `requireAdmin()`-gated + audit-logged |

### 3.1 Invite a new user

**What the admin does:** fill in name + email, pick role pill (Investor / CPA Admin), click **Send invite**.

**What the code does:**

```ts
// src/app/admin/users/actions.ts — inviteUserAction
const { data } = await sb.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName },
  redirectTo: `${APP_URL}/auth/callback?next=${
    role === 'admin' ? '/admin/profile' : '/dashboard'
  }`,
})

// Tag the invited user with the chosen role (tamper-proof)
await sb.auth.admin.updateUserById(data.user.id, {
  app_metadata: { role },
})

// For new admins, create a stub admin_profile row
if (role === 'admin') {
  await db.insert(adminProfile).values({
    userId: data.user.id,
    title: 'CPA',
    firmEmail: email,
  }).onConflictDoNothing()
}

// Audit
await db.insert(auditLog).values({
  actorId: me.id,
  actorRole: 'admin',
  action: 'user:invite',
  subjectType: 'user',
  subjectId: data.user.id,
  diff: { email, role },
})
```

**What Supabase does for free:**

1. Creates the user with `email_confirmed_at = now()` — an invite implies confirmed.
2. Fires the branded **Invite user** email template (edit in `Supabase dashboard → Auth → Email Templates`).
3. Email contains a magic link. Click → redirect to `${APP_URL}/auth/callback?code=...&next=/...`
4. Our `/auth/callback/route.ts` exchanges the code for a session.
5. `redirectTo` routes them: admins land on `/admin/profile`, customers on `/dashboard`.

**Already exists?** If the email is already a user, the Supabase call fails with "user already registered". The action catches that and falls back to `updateUserById` with the new role — so the same button can "invite a new user" OR "change an existing user's role".

### 3.2 Promote / Demote

```ts
// changeRoleAction
await sb.auth.admin.updateUserById(userId, {
  app_metadata: { ...existing.app_metadata, role: newRole },
})
```

Instant. No email. Their next page load runs the middleware with the new JWT → access changes immediately.

New admins get an `admin_profile` stub created automatically so the certificate generator has firm + title to merge in.

### 3.3 Resend invite

Supabase doesn't have a "resend invite" endpoint. We use the magic-link flow instead:

```ts
await sb.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: `${APP_URL}/auth/callback?next=/dashboard` },
})
```

Works for confirmed users who haven't signed in yet, or anyone who lost their password.

### 3.4 Deactivate

```ts
await sb.auth.admin.updateUserById(userId, { ban_duration: '876000h' }) // ≈ 100 years
await db.update(adminProfile)
  .set({ active: false })
  .where(eq(adminProfile.userId, userId))
```

Their current JWT stays valid until it expires (default 1 hour), then refresh fails. UI shows a red "Deactivated" chip.

### 3.5 Audit trail

Every action writes to `public.audit_log`:

| action | subject_type | diff | appears on |
|---|---|---|---|
| `user:invite` | user | `{ email, role }` | `/admin` recent activity |
| `user:set_role:admin` | user | `{ previousRole }` | same |
| `user:resend_invite` | user | `{ email }` | same |
| `user:deactivate` | user | — | same |

---

## 4. The invite → sign-in → land flow (sequence)

```
 Admin at /admin/users
        │ fills form + clicks Send
        ▼
 inviteUserAction (server, requireAdmin)
        │ requireAdmin()
        │ sb.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name } })
        │ sb.auth.admin.updateUserById(id, { app_metadata: { role } })
        │ db.insert admin_profile (if admin)
        │ db.insert audit_log
        ▼
 Supabase sends branded email with magic link
        │
        │ Invitee opens email
        ▼
 User clicks link → /auth/v1/verify?token=...&redirect_to=/auth/callback?next=/...
        │
        ▼
 /auth/callback/route.ts
        │ supabase.auth.exchangeCodeForSession(code)
        │ redirect(next)
        ▼
 /dashboard (customer)  OR  /admin/profile (admin)
        │
        │ Every subsequent request:
        │   Middleware checks JWT → passes or redirects
        │   Server components call requireUser/requireAdmin
        │   DB queries gated by RLS is_admin()
```

---

## 5. Three ways to manage users (all hit the same API)

| Method | File / command | When to use |
|---|---|---|
| **Web UI** — `/admin/users` | `src/app/admin/users/` | Day-to-day. Admins invite, promote, demote, deactivate. |
| **CLI** — `npm run user:create -- email password role` | `scripts/create-user.ts` | Seeding, CI, initial bootstrap. Creates a user with a known password in one shot (skips the invite email). |
| **CLI** — `npm run user:role -- email admin` | `scripts/set-role.ts` | Scripted role changes for existing users. |
| **CLI** — `npm run user:list` | `scripts/list-users.ts` | See every user + role + confirmed + created_at in a text table. |
| **Supabase dashboard** | Authentication → Users → click user → "Raw app_metadata" | Manual override / debugging. Edit the JSON directly. Trigger syncs everything else. |

All five write to the same `auth.users.app_metadata.role` field. Pick whichever fits the context.

---

## 6. What this design deliberately avoids

- ❌ **Role stored in your own DB table** that can drift from the JWT
- ❌ **Custom email-sending code** — Supabase templates are branded once, used for every invite / confirm / reset / magic link
- ❌ **Passwords emailed to users** — they set their own on first sign-in via the magic link
- ❌ **"Admin mode" toggle in UI** — role is binary + server-enforced, not a client setting
- ❌ **Separate sign-in pages for admins vs customers** — one `/sign-in` routes based on role
- ❌ **A "superuser" or "root" role** — two-role model (customer/admin) is enough for MVP; add a tier in `app_metadata` if ever needed
- ❌ **Hard-coded admin email lists** — the role is data, not code

---

## 7. How to brand the emails your users receive

Supabase owns the email templates. Edit once, apply forever.

1. Supabase dashboard → **Authentication** → **Email Templates**
2. Four templates to brand:
   - **Invite user** — sent when an admin invites someone via `/admin/users`
   - **Confirm signup** — sent when a user self-signs-up at `/sign-up`
   - **Magic Link** — sent for passwordless sign-in and "Resend invite"
   - **Reset Password** — sent when a user clicks "Forgot password"
3. Use these merge tags:
   - `{{ .SiteURL }}` — your app's base URL
   - `{{ .Email }}` — the recipient
   - `{{ .ConfirmationURL }}` — the magic link
4. Style with the navy + gold AgFinTax palette: `#0B1F3A` and `#C9A227`.

**Pro tip:** include a short "Why you're getting this email" paragraph and your CPA firm's support email. Issuers and customers trust branded, explanatory emails more than generic Supabase defaults.

---

## 8. Security posture recap

| Attack | Why it fails |
|---|---|
| User edits localStorage / cookies to make themselves admin | `app_metadata` isn't in user-editable storage. JWT is signed by Supabase — any tamper invalidates the signature. |
| User hits `/admin/queue` directly with their customer token | Gate 1 (middleware) redirects them to `/dashboard`. |
| User bypasses the app and calls Supabase REST with their token | Gate 4 (RLS) rejects the query. |
| Attacker steals an admin's session cookie | JWT expires in ~1 hour, refresh requires the signed refresh token. Deactivate the admin in `/admin/users` → their next refresh fails. |
| Admin clicks a phishing email and enters their Supabase password | Turn on MFA in `Supabase dashboard → Authentication → Policies`. |
| Someone finds a `service_role` key in git | They can do anything. **Never commit it.** `.env.local` is in `.gitignore`. If it leaks, rotate immediately in `dashboard → Settings → API Keys`. |

---

## 9. Related files

```
src/
  proxy.ts                                 ← Gate 1: middleware
  lib/
    auth.ts                                ← Gate 2: requireUser / requireAdmin
    supabase/server.ts                     ← createServiceClient for admin API
    supabase/middleware.ts                 ← session refresh + role check
  app/
    admin/
      users/
        page.tsx                           ← list + group by role
        invite-form.tsx                    ← controlled form
        role-control.tsx                   ← per-row actions
        actions.ts                         ← 4 server actions
      profile/
        page.tsx                           ← CPA editable profile
        admin-profile-form.tsx
        signature-manager.tsx              ← saved signature for one-click sign
        actions.ts                         ← saveAdminProfileAction + signature actions
    auth/
      callback/route.ts                    ← code ↔ session exchange
    sign-in/
      page.tsx + sign-in-form.tsx
scripts/
  seed.ts                                  ← creates demo customer + 2 admins
  create-user.ts                           ← npm run user:create
  set-role.ts                              ← npm run user:role
  list-users.ts                            ← npm run user:list
supabase/
  rls.sql                                  ← Gate 4: is_admin() + every policy + sync trigger
db/
  schema.ts                                ← user_profile + admin_profile + audit_log
```

---

## 10. Troubleshooting

**"User invited but they never got the email."**
- Check spam. The Supabase default sender is `noreply@mail.app.supabase.io` until you configure SMTP.
- In `Supabase dashboard → Project Settings → Auth → SMTP Settings`, plug in your own SMTP provider (SendGrid, Postmark, Resend, Amazon SES) so emails come from your own domain.

**"I clicked Promote but the user still can't see /admin."**
- Their JWT is cached. Have them sign out + sign in. Or wait ~1 hour for token refresh.

**"I demoted an admin but they can still see admin pages."**
- Same JWT-cache issue. Also check that the trigger fired — `select role from public.user_profile where id = 'uuid'` should return `customer`. If it's still `admin`, the trigger didn't fire; re-apply `supabase/rls.sql`.

**"I can't find the Invite user email template."**
- `Supabase dashboard → Authentication → Email Templates`. If you're on the legacy dashboard UI, try `Authentication → Templates`.

**"Two people tried to claim the same submission. Who won?"**
- Atomic SQL update — `WHERE status = 'pending_admin_review' AND assigned_admin_id IS NULL`. First one wins. The loser gets "Already claimed by another CPA".

**"I want a third role (e.g., `reviewer` who can see everything but can't approve)."**
- Add to the enum in `schema.ts`: `pgEnum('user_role', ['customer', 'admin', 'reviewer'])`.
- Add a matching value to `verification_path` if applicable.
- Update `is_admin()` to `is_admin_or_reviewer()` where read-only access is OK.
- Update `requireAdmin()` in `src/lib/auth.ts` accordingly.
- Update the UI pill selector in `invite-form.tsx`.

---

Last updated: 2026-04-19.
