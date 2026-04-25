# AgFinTax Certification Tool — Demo Guide

End-to-end test script for tomorrow's delivery. Walks through the full investor → CPA → certificate flow with real data and pre-generated test PDFs.

---

## 🔑 Test credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| **Investor** (customer) | `lakshmanjamili@gmail.com` | *your signup password* | `/dashboard` |
| **Investor** (seed) | `demo.customer@agfintax.dev` | `Demo12345!` | `/dashboard` |
| **CPA Admin** | `lakshman.techmind@gmail.com` | `Demo12345!` | `/admin` |
| **CPA Admin** (seed) | `anil.cpa@agfintax.dev` | `Demo12345!` | `/admin` |
| **CPA Admin** (seed) | `review.cpa@agfintax.dev` | `Demo12345!` | `/admin` |

Role is stored in `auth.users.app_metadata.role` (`customer` or `admin`). Only the service-role key can change it — tamper-proof from the browser. The `on_auth_user_created` Postgres trigger mirrors it to `public.user_profile.role` so SQL queries can filter.

---

## 📁 Test PDFs (pre-generated)

Location: **`docs/test-pdfs/`** (in this repo). Regenerate anytime: `npm run pdfs:test`. Override the output dir with `TEST_PDF_OUT=/tmp npm run pdfs:test`.

| File | Type | Year | Key values |
|---|---|---|---|
| `Test_1040_2024.pdf` | Form 1040 | 2024 | **AGI $358,000** · MFJ · Lakshman & Priya Jamili |
| `Test_1040_2025.pdf` | Form 1040 | 2025 | **AGI $372,000** · MFJ · same filer |
| `Test_Paystub_2026_Feb.pdf` | Pay stub | 2026 | **YTD $61,000** (annualizes to **$366,000**) |

Every PDF has a highlighted **"Key values"** box at the bottom with the exact Azure DI field names (`AdjustedGrossIncome`, `TaxYear`, `FilingStatus`, `YearToDateGrossEarnings`) so extraction is deterministic.

---

## 🧪 Expected verification outcome

**SEC Rule 501(a)(6) — Income path, Married Filing Jointly, $300,000 threshold.**

| Year | Value | Threshold | Pass? |
|---|---|---|---|
| 2024 · AGI from Form 1040 | $358,000 | $300,000 | ✅ |
| 2025 · AGI from Form 1040 | $372,000 | $300,000 | ✅ |
| 2026 · Current-year estimate (pay stub annualized) | $366,000 | $300,000 | ✅ |

→ **`sec-verify.ts` returns APPROVED** with reason code `INCOME_APPROVED`.

---

## 🎬 Demo flow — 10 minutes end-to-end

### Part 1 · Investor side (5 min)

1. **Landing page** — open `http://localhost:3001`.
   - Point out: serif Fraunces headline ("in days, not weeks"), the floating letter preview with gold seal, "Issued in 38 hours" chip, trust strip, 3-step How It Works, Pricing.
2. Click **Start verification** → `/sign-up` → sign in as `lakshmanjamili@gmail.com`.
3. **Dashboard** (`/dashboard`):
   - Personalized navy hero "Welcome, Lakshman."
   - 3 stat cards (Submissions · Documents · Certificates)
   - Click the **New verification** gold CTA.
4. **Verify picker** (`/verify`) — 4 path cards:
   - Pick **Income** → expand reveals required docs + turnaround
   - Pick **Married filing jointly** in the filing-status section below (threshold updates to $300,000)
   - Click **Start submission**.
5. **Submission detail page** (`/verify/[id]`):
   - Top navy hero: "Welcome, Lakshman. Let's gather what the SEC needs." + 5-step progress rail
   - Right rail: **"What we need" checklist · 0 of 3**
   - Left: **per-year structured slots** with "Yes — filed" / "Not yet filed" toggle
6. **Upload all 3 PDFs**:
   - Click **"Yes — filed"** for Tax Year 2025 → drop `Test_1040_2025.pdf` into the `Form 1040 — Tax Year 2025 (Required)` slot
   - Drop `Test_1040_2024.pdf` into the `Form 1040 — Tax Year 2024 (Required)` slot
   - Pick **"Pay stubs"** for Current Year 2026 → drop `Test_Paystub_2026_Feb.pdf`
   - Filenames contain the year → slots auto-match immediately
7. **Watch extraction run** (~20–45s): page auto-refreshes every 6s via `<AutoRefresh />`. Docs flip from "Queued" → "Reading…" → "Extracted · 87%".
8. **Checklist turns 3/3** green.
9. Tick **I attest…** → click **Submit for CPA review**.
10. **Post-submit view** appears with:
    - Navy receipt "Here's what we sent to your CPA"
    - **Preliminary AI evaluation · Meets threshold · CPA approval ready** — all 3 rule rows show ✅ green check, real dollar values vs $300K
    - "What we extracted from your documents" — 3 cards with highlighted AGI / YTD values + confidence %
    - "What happens next" timeline with active "CPA review · Now" step
11. Sign out.

### Part 2 · CPA admin side (4 min)

1. Sign in as `lakshman.techmind@gmail.com` / `Demo12345!` → `/admin`.
2. **Admin overview**:
   - Personalized navy hero
   - 4 live KPI cards: **Unassigned · 1** (gold-ringed), My queue, Approved today, Certificates this week
   - "Waiting for a CPA" callout with the just-submitted case
   - "Your recent decisions" + "Recent activity" audit feed
3. Click **Open available queue** → `/admin/queue`.
4. Available tab shows the new submission. Click **Claim** (atomic — can't be double-claimed).
5. Auto-routed to `/admin/submissions/[id]`:
   - **"What the customer uploaded"** — 3 document cards with every extracted Azure field shown + confidence %, SSNs auto-masked to `***-**-****`, "Open document" button opens the original PDF via a 15-min signed URL
   - **"Review Summary"** card (right rail) — same rule evaluation the customer saw, real values lit up green, reason pills
   - **Customer** card with email, attestation timestamp
6. **One-click approve & sign** (if you've saved a signature on `/admin/profile`):
   - Gold-bordered panel appears
   - Check the certification checkbox
   - Click **Approve & auto-sign** → certificate is generated with your signature embedded in ~2 seconds
   - *Fallback:* if no saved signature, the draw-pad modal appears instead
7. Point out the toast "Certificate AGF-2026-XXXXXX issued".
8. Sign out.

### Part 3 · Customer receives it (1 min)

1. Sign back in as `lakshmanjamili@gmail.com`.
2. Bell icon in the header → unread notification "Your verification certificate is ready".
3. Click → lands on the submission, now shows **"Approved · certificate ready"** card with **Open Vault** link.
4. Go to `/letter`:
   - Your certificate card with "Valid · until {date + 90 days}" chip
   - Click **Preview** → `/letter/[certId]` → full-page formal letter renders with:
     - Navy letterhead bar, gold CPA seal with circular "ACCREDITED · VERIFIED · AGFINTAX" text
     - Serif "To Whom It May Concern,…" body
     - Gold left-rule subject block with your name
     - Your CPA's drawn signature (inline image)
     - Letter number, reference, valid-through date
5. Click **Download PDF** — branded pdf-lib document with embedded QR code.
6. Scan QR → opens `/verify-public/AGF-2026-XXXXXX` → shows **VALID** status with investor initials only (no PII).

---

## 🛠️ Admin user management (/admin/users)

1. Navigate to `/admin/users` (in the top nav).
2. **Invite form** at top:
   - Enter any name + email + select **Investor** or **CPA / Admin**
   - Click **Send invite** → Supabase fires a branded magic-link email
   - User clicks link → auto-confirms + signs in → routed to `/dashboard` (investor) or `/admin/profile` (admin)
3. **Users table** grouped into **CPAs (admins)** and **Investors (customers)** — status chips (Admin / Investor, Confirmed / Pending invite / Deactivated), last sign-in time.
4. **Per-row actions**:
   - **Resend** → fires a fresh magic-link email
   - **Promote / Demote** → flips `app_metadata.role`
   - **Red ShieldOff icon** → deactivates (ban for ~100 years)
5. Supabase email templates are edited in **Supabase dashboard → Auth → Email Templates** (Invite user · Confirm signup · Magic link · Reset password).

---

## 🧰 Useful commands

```bash
# PDFs
npm run pdfs:test                    # regenerate the 3 test PDFs to ~/Documents

# Users
npm run user:list                    # see every user + role + confirmed status
npm run user:role -- <email> admin   # promote to admin
npm run user:role -- <email> customer # demote
npm run user:create -- email pw role # create user directly (e.g. for CI)

# Extraction debugging
npm run test:extract -- docs/test-pdfs/Test_1040_2024.pdf form_1040

# Database
npm run db:push                      # apply schema changes
npm run db:rls                       # reapply RLS policies
npm run db:seed                      # re-seed demo users (idempotent)

# Dev
npm run dev                          # starts on :3001 (prod :3000 might be taken)

# CI-style checks
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

---

## 🔒 Security model at a glance

```
             ┌──────────────────────────────┐
             │ auth.users (Supabase-managed)│
             │   · id (UUID)                │
             │   · email                    │
             │   · app_metadata.role ←───── only service-role key can set this
             └────────────┬─────────────────┘
                          │  on insert/update trigger
                          ▼
             ┌──────────────────────────────┐
             │ public.user_profile          │
             │   · id (FK → auth.users.id)  │
             │   · email, full_name, phone  │
             │   · role (enum: customer|admin) ← auto-synced
             └────────────┬─────────────────┘
                          │ FK'd to every app table
                          ▼
       ┌──────────────┬────────────────┬─────────────────┐
       │ submission   │ document       │ certificate     │
       │ FK customerId│ FK submissionId│ FK submissionId │
       └──────────────┴────────────────┴─────────────────┘
                          │
                          │  All reads gated by RLS:
                          │    `public.is_admin()` helper →
                          │    reads auth.jwt() → app_metadata.role
                          ▼
       Defense-in-depth checks (4 layers):
       1. Proxy / middleware     — redirects /admin/* unless role='admin'
       2. Layout requireAdmin()  — double-check in every admin layout
       3. Server-action guards   — every mutating action calls requireAdmin()
       4. Row-Level Security     — Postgres policies on every table
```

---

## 🐛 Troubleshooting

**Extraction stuck on "Queued":**
The job runner fires fire-and-forget after each upload. Locally you can trigger manually:

```bash
curl -X POST -H "x-cron-secret: $(grep ^CRON_SECRET .env.local | cut -d= -f2)" \
  http://localhost:3001/api/jobs/run
```

**Azure DI returns 401:**
Key or endpoint isn't set. `grep ^AZURE_DI_KEY .env.local` should show a 80+ char value. Rotate in Azure portal if needed.

**Checklist stays at 0/3:**
Not a bug — your uploaded PDFs may have tax years that don't match 2024/2025 (e.g., a 2022 return). The counter now counts *any* uploaded doc of the right type (matched + pending + mismatch) so progress always advances.

**"Cannot claim submission":**
Admin session expired, or the submission was claimed by another CPA (atomic check). Refresh `/admin/queue` to see current state.

**CPA sign returns "No saved signature":**
Go to `/admin/profile` → scroll down → Signature Manager card → draw + save. One-click approve-and-sign only works after you have one on file; fallback is the per-cert draw-pad modal.

**DOCX template missing:**
Copy `templates/verification-letter.docx` from the git repo. PDF generation doesn't need it — only DOCX output.

---

## ⚠️ Pre-demo checklist

- [ ] Dev server running on port 3001 (`npm run dev`)
- [ ] Demo accounts can sign in (both customer + admin)
- [ ] Admin has **saved signature** on `/admin/profile` (for one-click approve demo)
- [ ] Test PDFs exist in `docs/test-pdfs/` (run `npm run pdfs:test` if needed)
- [ ] Azure DI key is valid — confirm with `npm run test:extract -- docs/test-pdfs/Test_1040_2024.pdf form_1040`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_DI_KEY`, and the OpenRouter key **rotated** if leaked in chat
- [ ] Supabase auth email templates branded (optional but ideal — `dashboard → Auth → Email Templates`)
- [ ] Browser dev tools closed unless you want to show XHR / Supabase calls

---

## 📊 What's implemented (as of 2026-04-19)

| Feature | Status |
|---|---|
| Supabase Auth + RLS + storage policies | ✅ |
| 13-table Drizzle schema live on Supabase | ✅ |
| Azure Document Intelligence (12 prebuilt tax models) with fallback chain | ✅ |
| Fuzzy field finder for AGI / Wages / YTD (handles nested Azure responses) | ✅ |
| SEC Rule 501(a)(5) Net Worth, 501(a)(6) Income, 501(a)(7)/(9) Entity ($5M) | ✅ |
| Customer: path picker, structured slot uploader, checklist, attestation | ✅ |
| Customer: post-submit package (extracted values + preliminary evaluation + timeline) | ✅ |
| Customer: auto-refresh polling while extraction pending | ✅ |
| Customer: editable profile | ✅ |
| Customer: formal letter preview (on-screen version of the PDF) | ✅ |
| Admin: 4-tab queue with atomic claim | ✅ |
| Admin: rich document inspector (every Azure field + confidence + PII masking) | ✅ |
| Admin: live rule evaluation | ✅ |
| Admin: decision panel (approve / request changes / reject with notes) | ✅ |
| Admin: draw-pad signature per cert | ✅ |
| Admin: **saved profile signature** (one-time draw) | ✅ |
| Admin: **one-click approve & auto-sign** with saved signature | ✅ |
| Admin: revoke certificate with reason | ✅ |
| Admin: user management (invite / promote / demote / deactivate) | ✅ |
| Admin: live KPI overview + audit feed | ✅ |
| Certificates: PDF via pdf-lib (QR code, seal, CPA sig) | ✅ |
| Certificates: DOCX via PizZip + letter template | ✅ |
| Public verify page at `/verify-public/[cert]` (VALID / EXPIRED / REVOKED) | ✅ |
| Back-and-forth Changes-Requested loop | ✅ |
| Notification bell in header with unread count | ✅ |
| "Digital Ledger" Claude design system fully ported (ink + gold + cream, Fraunces + General Sans) | ✅ |
| 21 unit tests (sec-verify branches + thresholds) | ✅ |

### Deferred to post-MVP

- Email via Resend for transactional events (currently in-app notifications only — Supabase sends auth-related emails)
- Rate limits on upload + cron endpoints
- Integration tests (end-to-end submit → approve → letter)
- Series 7/65/82 professional-license path UI (logic in place; flagged MVP-deferred in picker)
- Net-worth line-item builder on admin side (schema exists, UI simplified for MVP)

---

**Built with:** Next.js 16 App Router · React 19 · TypeScript · Supabase (Auth + Postgres + Storage) · Drizzle ORM · Azure Document Intelligence · pdf-lib · docxtemplater · signature_pad · Tailwind v4 · Fraunces + General Sans · shadcn-inspired primitives.

**License:** AgFinTax Advisors, LLC — proprietary.
