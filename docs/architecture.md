# AG FinTax Accredited Certification Tool — Architecture

_Last updated: 2026-04-21_

---

## 1. What this app does

AG FinTax delivers SEC Rule 506(c) "reasonable-steps-to-verify" accredited-investor
letters. A customer uploads tax returns / statements / credentials; Azure
Document Intelligence extracts key fields; a licensed CPA reviews every value
side-by-side with the source PDF, signs the letter, and a tamper-evident PDF
is issued with a QR-verifiable public link.

The deliverable matches the third non-exclusive verification method in
SEC Rule 506(c):

> "Written confirmation from a registered broker-dealer, an SEC-registered
> investment adviser, a licensed attorney, or a certified public accountant
> stating that within the last three months they have taken reasonable steps
> to verify that the investor is an accredited investor."

---

## 2. System context

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Customer    │    │  Admin / CPA │    │   Issuer     │
│   (web)      │    │    (web)     │    │   (public    │
└──────┬───────┘    └──────┬───────┘    │  verify URL) │
       │                   │            └──────┬───────┘
       ▼                   ▼                   │
┌────────────────────────────────────────────┐ │
│           Next.js 16 App Router             │ │
│   React 19 · TypeScript · Tailwind v4       │ │
│                                             │◀┘
│  routes: /, /about, /sign-in, /sign-up,     │
│          /dashboard, /verify, /verify/[id], │
│          /letter, /letter/[id],             │
│          /verify-public/[certNumber],       │
│          /admin, /admin/queue,              │
│          /admin/submissions/[id],           │
│          /admin/users, /admin/profile       │
│                                             │
│  APIs: /api/submissions/[id]/documents,     │
│        /api/certificates/[id]/download,     │
│        /api/jobs/run (legacy), /api/health  │
└─────┬──────────────┬──────────────┬─────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐   ┌────────────┐  ┌─────────────┐
│ Supabase │   │ Supabase   │  │ Azure       │
│ Auth +   │   │ Storage    │  │ Document    │
│ Postgres │   │ (private)  │  │ Intelligence│
│          │   │            │  │ v4 API      │
└──────────┘   └────────────┘  └─────────────┘
     │
     ▼
┌──────────────┐
│ OpenRouter   │  (optional — LLM narrative for admin review card)
│ (Claude 3.5) │
└──────────────┘
```

---

## 3. Tech stack

| Layer        | Choice                                                |
|--------------|-------------------------------------------------------|
| Framework    | Next.js 16 (App Router, RSC), React 19                |
| Language     | TypeScript 5.9, strict mode                           |
| Auth         | Supabase Auth (email + magic link) · `app_metadata.role` as source of truth |
| Database     | Supabase Postgres 15 · Drizzle ORM · Row-Level Security |
| Storage      | Supabase Storage (private bucket `accreditation-docs`) · signed URLs for viewing |
| OCR / extract| Azure Document Intelligence v4 (`2024-02-29-preview`), 12 prebuilt tax models + layout fallback |
| AI narrative | OpenRouter (defaults to `anthropic/claude-3.5-sonnet`) — optional, deterministic fallback |
| PDF          | `pdf-lib` (two-page AG FinTax letter, no LibreOffice) |
| DOCX         | `pizzip` + literal-bracket placeholder replacement (vendor template) |
| QR           | `qrcode` (verify URL embedded in PDF)                 |
| Signature pad| `signature_pad` (drawn) · reusable saved image on `admin_profile` |
| UI           | Tailwind CSS v4, Radix primitives, `lucide-react`, Fraunces serif + General Sans + Homemade Apple |
| Testing      | Vitest unit tests (`tests/sec-verify.test.ts` + `tests/placeholder.test.ts`) |
| Deploy       | Vercel (app) + Supabase (DB/Auth/Storage) + Azure DI  |

---

## 4. Roles & security model

Two roles, one source of truth: **`auth.users.raw_app_meta_data.role`**.

- `app_metadata.role` is written by the **service-role** key only — users
  cannot self-promote.
- A Postgres trigger `on_auth_user_created` mirrors the role into
  `public.user_profile.role` on sign-up.
- A helper `public.is_admin()` reads the JWT's `app_metadata.role` — used
  by every RLS policy.

### 4.1 Row-level security summary

| Table                   | Customer can read      | Customer can write      | Admin can read  | Admin can write |
|-------------------------|-----------------------|-------------------------|-----------------|-----------------|
| `submission`            | own rows               | own drafts              | all             | all             |
| `document`              | own submissions        | own submissions (insert)| all             | all             |
| `extracted_field`       | own submissions        | —                       | all             | service role    |
| `review_decision`       | own submissions        | —                       | all             | own admin_id    |
| `certificate`           | own (non-revoked)      | —                       | all             | service role    |
| `admin_profile`         | —                      | —                       | own             | own             |
| `audit_log`             | —                      | —                       | all             | service role    |

All writes into `submission` status / `certificate` rows go through server
actions that re-check ownership (customer) or assignment (admin) at the
application layer — RLS is the second line of defense.

### 4.2 Admin onboarding flow

1. Super-admin signs in
2. Goes to `/admin/users`, invites an email
3. `supabase.auth.admin.inviteUserByEmail()` sends a magic-link email with
   `app_metadata.role='admin'` already stamped
4. Invitee clicks the link, sets password, lands on `/admin` with CPA
   workspace immediately visible
5. Any admin can promote/demote other users (single-role flip) from
   `/admin/users` — promotion is recorded in `audit_log`

Customers register via `/sign-up` — the trigger defaults them to
`role='customer'`.

---

## 5. Verification paths

Four paths, each with its own requirement plan (`src/lib/verify-requirements.ts`):

| Path             | SEC rule        | Threshold                         | Required docs                                      |
|------------------|-----------------|-----------------------------------|----------------------------------------------------|
| `income`         | 501(a)(6)       | $200K individual / $300K joint    | 1040 for year N-1, 1040 for year N-2, current-year W-2 or 2 paystubs · **K-1 optional** |
| `net_worth`      | 501(a)(5)       | $1,000,000 excl. primary residence| Bank + brokerage + retirement statements · liabilities · primary-residence form |
| `entity_assets`  | 501(a)(3)/(7)   | $5,000,000 total assets           | Entity financial statements · formation/good-standing docs · optional beneficial-owner list |
| `professional`   | 501(a)(10)      | Active Series 7 / 65 / 82         | FINRA BrokerCheck PDF (< 30 days old)              |

Each plan returns `{ slots[], ready, completion: { filled, total }, summary }`.
The customer's checklist + admin's review summary are both derived from the
same plan object.

### 5.1 Filing-status → threshold (income path)

| Filing status             | Threshold     |
|---------------------------|---------------|
| Single                    | $200,000      |
| Married filing separately | $200,000      |
| Head of household         | $200,000      |
| Qualifying surviving spouse | $200,000    |
| Married filing jointly    | $300,000      |
| Spousal equivalent        | $300,000      |

---

## 6. Data model (Drizzle schema)

### 6.1 Enums

```
user_role:         customer | admin
submission_status: draft | pending_admin_review | assigned | in_review |
                   changes_requested | approved | letter_generated |
                   rejected
verification_path: income | net_worth | professional | entity_assets
filing_status:     single | mfj | mfs | hoh | qss | spousal_equivalent
document_type:     form_1040 | w2 | paystub | k1 |
                   bank_statement | brokerage_statement | retirement_statement |
                   real_estate | business_ownership | crypto_wallet |
                   life_insurance |
                   mortgage_statement | credit_card_statement | loan_statement |
                   entity_financials | entity_formation | finra_credential |
                   other
extraction_status: pending | in_progress | done | failed
decision_type:     approve | request_changes | reject
rule_status:       approved | rejected | manual_review
nw_category:       asset | liability | adjustment
nw_subtype:        cash | brokerage | retirement | real_estate |
                   business | crypto | life_insurance | mortgage |
                   credit_card | loan | other_asset | other_liability
notification_type: submitted | approved | rejected | changes_requested | letter_ready
job_kind:          extract | generate_letter | notify (legacy)
job_status:        pending | in_progress | done | failed (legacy)
```

### 6.2 Tables (13)

```
auth.users                      — Supabase-managed
└─ user_profile                 — mirror: id, email, full_name, phone, role
   └─ admin_profile             — cpa_license_no, title, firm_*, jurisdiction,
                                  signature_image_path, default_validity_days,
                                  typed_signature_block
   └─ submission                — customer_id, status, verification_path,
                                  filing_status, tax_year_primary/secondary,
                                  investor_name, investor_address_line_1/2,
                                  assigned_admin_id, claimed_at, submitted_at,
                                  avg_confidence, customer_attested_at
      ├─ document               — type, storage_path, extraction_status,
      │                           azure_model_id, confidence, raw_extraction (jsonb),
      │                           extracted_at, error_message
      │   └─ extracted_field    — (legacy — detailed per-field rows)
      ├─ rule_evaluation        — status, threshold, reasons (jsonb), computed (jsonb)
      ├─ review_decision        — admin_id, decision, notes
      ├─ net_worth_line_item    — category, subtype, label, amount_cents,
      │                           confidence, source_doc_id, cpa_adjusted
      ├─ primary_residence_info — owns_residence, fmv_cents, mortgage_cents,
      │                           mortgage_changed_60d, change_description
      └─ certificate            — certificate_number, path, pdf_storage_path,
                                  docx_storage_path, signature_storage_path,
                                  valid_through, snapshot (jsonb),
                                  revoked, revoked_at, revoked_by_admin_id,
                                  download_count
  └─ notification               — user_id, type, title, body, read_at,
                                  related_submission_id
  └─ audit_log                  — actor_id, actor_role, action, subject_*,
                                  diff (jsonb), ip, user_agent
  └─ job                        — (legacy extractor queue — no longer used
                                  on the hot path; inline extract ships
                                  results synchronously)
```

### 6.3 Migrations

```
supabase/migrations/
  001_initial.sql            (implicit via drizzle push)
  002_entity_path.sql        (adds entity_assets to verification_path)
  003_admin_signature.sql    (signature_image_path on admin_profile)
  004_document_types.sql     (k1, entity_financials, entity_formation,
                              finra_credential)
```

---

## 7. Customer journey

1. **Sign up** (`/sign-up`) — email + password; Supabase magic-link enabled.
   Trigger stamps `role='customer'`.
2. **Pick path** (`/verify`) — 4-card picker: Income / Net worth / Entity / Professional.
   Income path asks for filing status (threshold resolves instantly).
3. **Upload** (`/verify/[submissionId]`) — structured uploader with per-path
   slots. The client uploads directly to Supabase Storage with a signed URL,
   then POSTs a metadata record.
4. **Inline extraction** — `POST /api/submissions/[id]/documents` runs Azure
   DI synchronously:
   - Routes to the specialized model for the doc type
   - Falls back to `prebuilt-layout` if the specialized model 404s (some
     Azure regions don't have every prebuilt model)
   - Writes `raw_extraction` + confidence back to the row
   - If it's a Form 1040, `hydrateSubmissionFromForm1040()` fills the
     submission's `investor_name` / `address_line_1` / `address_line_2` /
     `tax_year_primary` / `tax_year_secondary` / `filing_status` from the
     highest-confidence 1040 — the letter template renders from those fields.
   - Returns `{ ok, documentId, extraction: { status, confidence, fields[],
     fallbackUsed?, fallbackReason? } }` in ~5–15 s
5. **Pre-submit summary** — `PreSubmitSummary` component shows every
   document with key-value chips + confidence so the customer can catch
   mis-reads before the CPA ever sees it.
6. **Attest + submit** — checkbox + server action transitions submission
   status to `pending_admin_review`.
7. **Wait** — customer sees a timeline. Auto-refresh polls the server while
   extraction or CPA-review is in flight.
8. **Download** (`/letter/[certificateId]`) — PDF download only. The DOCX is
   generated as a backup but is not exposed in the UI (Word documents can
   be edited).
9. **Share** (`/verify-public/[certNumber]`) — public verify page that
   shows the cert status + QR-matched URL; issuers can check authenticity
   without logging in.

---

## 8. CPA / Admin journey

1. **Accept invite** → lands on `/admin`
2. **Set up profile** (`/admin/profile`) — CPA name, license #, jurisdiction,
   title, firm name/city/email, default validity days, and a drawn
   signature that gets reused on every subsequent letter.
3. **Work the queue** (`/admin/queue`) — 3 tabs: Available (unassigned) /
   Mine / All.
4. **Claim** a submission — atomic transition, prevents two CPAs from
   touching the same file.
5. **Review** (`/admin/submissions/[id]`):
   - Split-view: PDF on the left, extracted fields on the right, tabs
     along the top to swap both panes together
   - Sidebar: rule evaluation (`sec-verify.ts`), eligibility summary
     (optional LLM narrative), customer card, decision panel
6. **Decide**:
   - Approve → moves to `approved`
   - Request changes → freezes the sub; customer gets a banner + can edit
   - Reject → terminal
7. **Sign & generate**:
   - Quick-approve (uses saved signature) — one click
   - Or open signature modal, draw + confirm
   - Server builds the PDF (`buildLetterPdf`) with CPA name, license,
     jurisdiction, firm, title, embedded signature, Reg D checkbox ticked
     for the chosen path
8. **Revoke** if needed (`RevokeCertificateButton`) — 410 Gone on the
   public verify URL; reason stored in `audit_log`.

---

## 9. Extraction pipeline

```
         ┌─────────────────────────┐
Upload → │ POST /documents         │
         │                         │
         │ 1. insert document row  │
         │    status=in_progress   │
         │ 2. download from Supabase│
         │    Storage              │
         │ 3. analyzeDocument(     │
         │      model[type],       │
         │      bytes              │
         │    )                    │
         │                         │
         │    if specialized 404   │
         │      → prebuilt-layout  │
         │        fallback         │
         │                         │
         │ 4. normalize fields     │
         │    (fieldToCents, etc)  │
         │ 5. update document row  │
         │    raw_extraction,      │
         │    confidence, model    │
         │ 6. if form_1040         │
         │    → hydrate submission │
         │      (name/address/years)│
         │ 7. return JSON          │
         └─────────────────────────┘
```

- `maxDuration = 60` on the route (Vercel Pro)
- Typical Azure DI latency: 5–12 s for a single-page form, 10–18 s for
  multi-page 1040s

### 9.1 Model routing (`src/lib/extraction.ts`)

| doc type              | Azure model                                |
|-----------------------|--------------------------------------------|
| `form_1040`           | `prebuilt-tax.us.1040`                     |
| `w2`                  | `prebuilt-tax.us.w2`                       |
| `paystub`             | `prebuilt-payStub.us`                      |
| `k1`                  | `prebuilt-layout` (no prebuilt available)  |
| `bank_statement`      | `prebuilt-bankStatement.us`                |
| `brokerage_statement` | `prebuilt-bankStatement.us` (closest)      |
| `retirement_statement`| `prebuilt-bankStatement.us` (closest)      |
| everything else       | `prebuilt-layout`                          |

### 9.2 Form 1040 key-value extraction

Fuzzy field finder handles Azure's inconsistent key names:
- AGI ← `AdjustedGrossIncome` | `AGI` | `Line 11` | `Box 11` | `Box 11a`
- Tax year ← `TaxYear` | `Year` | `TaxFormYear`
- Filing status ← `FilingStatus` (normalized to `single`/`mfj`/`mfs`/`hoh`/`qss`)
- Primary filer ← `FirstName` + `MiddleInitial` + `LastName` (or `Taxpayer`/`TaxpayerName` fallback)
- Spouse (for joint filers) ← `Spouse*First/Middle/Last`
- Combined investor name: `"John & Jane Doe"` when joint with matching surname, `"John Doe & Jane Roe"` otherwise, `"John Doe"` solo — matches the reference AG FinTax letter format
- Address ← parsed into street (line 1) + `"CITY, ST ZIP"` (line 2)

### 9.3 Current-year income (paystubs / W-2)

- **Paystubs**: annualized from YTD × (12 / current month), or gross ×
  `periodMultiplier(payPeriod)` if no YTD
- **Year-match**: `raw_extraction.taxYear` → falls back to filename regex
  `(?<!\d)(20\d{2})(?!\d)` (digit lookarounds — `\b` boundaries don't fire
  around underscores, which broke `Test_Paystub_2026_Feb.pdf` before this)

---

## 10. Letter generation

### 10.1 PDF (`src/lib/letter-pdf.ts`) — primary deliverable

Two-page document generated with `pdf-lib`:

- **Page 1 — cover letter**: AG FinTax wordmark (orange "AG" + navy "FinTax"),
  date, investor name + address, "Dear Mr. X & Mrs. Y," salutation,
  four-paragraph disclaimer body, "Sincerely, AG FinTax, LLC", "Encl:
  Accredited Investor Verification Letter", office address + certificate
  number footer
- **Page 2 — accredited investor verification letter**: title,
  "Name of Investor: {name} (the \"Investor\")", licensed-accountant line
  (`Jurisdiction: {state} License #: {no}`), 7 criteria with the correct
  one checked, "I am pleased to confirm..." closing, NAME / SIGNATURE
  (embedded PNG) / DATE / COMPANY / TITLE block, footer with certificate
  number + valid-through date

### 10.2 DOCX (`src/lib/letter-docx.ts`) — backup, not exposed

Fills the vendor-supplied Word template (`templates/verification-letter.docx`)
via PizZip raw-XML replacement. The tricky part: Word splits `[John & Jane
Doe]` across multiple `<w:t>` runs, so straight string replacement misses
them. `rewriteParagraph()` walks each `<w:p>`, concatenates the text across
runs (preserving `<w:br/>` soft breaks), does the placeholder swap, then
rebuilds the runs — preserving paragraph + font properties.

### 10.3 Checkbox mapping (`src/lib/placeholder-mapper.ts`)

| Path            | Checked box                                    |
|-----------------|------------------------------------------------|
| `net_worth`     | 0 — net worth > $1M excl. primary residence    |
| `income`        | 1 — individual income > $200K / joint > $300K  |
| `professional`  | 1 (nearest match — template has no pro box)    |
| `entity_assets` | 5 — business/entity/trust/LLC                  |

---

## 11. SEC rule engine (`src/lib/sec-verify.ts`)

Pure-function evaluator. Given `VerificationInputs` returns:

```ts
{
  status: 'approved' | 'rejected' | 'manual_review',
  threshold: number,              // in cents
  computed: {
    incomeY1?: number,
    incomeY2?: number,
    incomeY3Est?: number,
    netWorth?: number,
    assets?: number,
    liabilities?: number,
  },
  reasons: { code, severity, message }[],
  avgConfidence: number | null,
}
```

- **Income path**: both prior-year AGIs ≥ threshold AND current-year
  estimate ≥ threshold → approved
- **Net worth path**: assets − liabilities − primary residence equity ≥
  $1,000,000 → approved (if mortgage changed in last 60 days with
  increase, flag for manual review)
- **Entity / professional**: rule engine defers to CPA — always returns
  `manual_review` with a `[info]` reason

Manual review is the safe default — the CPA gets a pre-digested summary
but always makes the final call.

---

## 12. AI-assisted summary (optional)

`src/lib/eligibility-summary.ts` can call OpenRouter to generate a
2–4-sentence CPA-facing narrative + 1–4 "please verify" bullets. The
LLM never does math — all numbers come from Azure DI / the rule engine.
If `OPENROUTER_API_KEY` is unset, a deterministic fallback is used
(built from the rule-engine reasons + extracted data).

---

## 13. Env variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           # server-side mutations + storage
SUPABASE_STORAGE_BUCKET             # default: accreditation-docs
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET

DATABASE_URL                        # pooler URL (pgbouncer)
DIRECT_DATABASE_URL                 # direct for drizzle-kit push

AZURE_DI_ENDPOINT                   # https://{resource}.cognitiveservices.azure.com
AZURE_DI_KEY
AZURE_DOCINTEL_API_VERSION          # defaults to 2024-02-29-preview

NEXT_PUBLIC_APP_URL                 # used for QR + public verify URLs
CRON_SECRET                         # shared secret for /api/jobs/run (legacy)

OPENROUTER_API_KEY                  # optional — LLM narrative
OPENROUTER_MODEL                    # default: anthropic/claude-3.5-sonnet
```

---

## 14. Folder map

```
Ag-accredited-certification-tool/
├── docs/                           # DEMO.md, USERS_AND_ROLES.md, this file,
│                                   # test-pdfs/, smoke-out/, reference letter
├── scripts/                        # db:seed, db:rls, create-user, set-role,
│                                   # list-users, test-extract, smoke-*
├── supabase/migrations/            # 001, 002_entity_path, 003_admin_signature,
│                                   # 004_document_types
├── templates/verification-letter.docx
├── tests/                          # vitest unit tests
├── public/images/                  # Anil Grandhi photo + assets
└── src/
    ├── app/
    │   ├── (root)/page.tsx         # landing
    │   ├── about/                  # About AG FinTax + Anil Grandhi
    │   ├── sign-in, sign-up
    │   ├── dashboard/              # customer home
    │   ├── verify/                 # path picker
    │   │   └── [submissionId]/     # per-submission uploader + summary
    │   ├── letter/                 # customer vault + per-cert
    │   ├── verify-public/          # QR-accessible issuer view
    │   ├── admin/
    │   │   ├── (root)/page.tsx     # overview
    │   │   ├── queue/              # Available / Mine / All
    │   │   ├── submissions/        # split-view review
    │   │   ├── users/              # invite / promote / demote
    │   │   └── profile/            # CPA profile + signature
    │   └── api/
    │       ├── submissions/[id]/documents/route.ts   # inline extract
    │       ├── certificates/[id]/download/route.ts   # gated PDF download
    │       ├── jobs/run/route.ts                     # legacy cron runner
    │       └── health/route.ts
    ├── components/
    │   ├── admin/                  # admin-shell, split-review, decision-panel,
    │   │                           # signature-pad, quick-approve, review-summary,
    │   │                           # eligibility-summary-card, revoke-button
    │   ├── customer/               # structured-uploader, submit-panel,
    │   │                           # pre-submit-summary, verify-checklist,
    │   │                           # submission-hero, submission-package,
    │   │                           # changes-banner, auto-refresh
    │   ├── shared/                 # app-header, notification-bell,
    │   │                           # verification-letter, seal
    │   └── ui/                     # button, badge, card, wordmark, input, etc.
    ├── db/
    │   ├── schema.ts               # drizzle table/enum definitions
    │   └── client.ts               # postgres + drizzle pool
    └── lib/
        ├── auth.ts                 # requireUser / requireAdmin
        ├── azure-di.ts             # Azure DI client + normalize
        ├── extraction.ts           # model routing + keyValues + displayFields
        ├── hydrate-submission.ts   # 1040 → submission auto-fill
        ├── aggregate-extraction.ts # per-doc summary + rule-engine inputs
        ├── verify-requirements.ts  # slot plans per path
        ├── sec-verify.ts           # pure rule engine
        ├── eligibility-summary.ts  # optional LLM narrative
        ├── placeholder-mapper.ts   # DOCX bracket placeholders + checkboxes
        ├── letter-docx.ts          # DOCX builder
        ├── letter-pdf.ts           # PDF builder (primary deliverable)
        ├── certificate-pdf.ts      # legacy branded cert PDF (not used now)
        ├── certificate-number.ts   # AG-YYYY-XXX number generator
        ├── signed-urls.ts          # Supabase signed-URL helper
        ├── supabase/               # browser + server clients
        ├── brand.ts                # brand tokens
        ├── constants.ts            # thresholds, validity, storage paths
        ├── utils.ts                # cn, date formatters
        └── zod/                    # input validators
```

---

## 15. Notable design decisions

1. **Inline extraction, not a job queue.** Azure DI returns in 5–15 s;
   the customer sees real-time confidence the moment the upload completes.
   The legacy `job` table + `/api/jobs/run` cron route remain for
   backward compatibility but the hot path is synchronous.
2. **Fallback is success, not failure.** If Azure 404s on a specialized
   model, we silently fall back to `prebuilt-layout` (always available)
   and mark the doc `done` with `fallbackUsed=true`. The CPA still gets
   the raw OCR text and the file preview — the bar is "the CPA can do
   their job," not "every field parsed perfectly."
3. **PDF-only delivery.** DOCX is still generated for internal archival
   but not exposed — Word files can be edited by recipients. The PDF is
   the tamper-evident artifact.
4. **`app_metadata.role` as single source of truth.** Role flips are
   service-role writes; the `user_profile` mirror is derived via trigger.
   No user-land mutation can escalate privileges.
5. **CPA profile reuse.** One-time signature draw populates every
   subsequent letter — one-click approve becomes a real button, not a
   modal.
6. **SEC alignment.** The letter explicitly invokes Rule 501(a) of Reg
   D; the rule engine's thresholds match the official limits; the 7
   criteria checkboxes are the exact SEC list.

---

## 16. Known gaps / Phase 6+

- [ ] Rate-limit the upload endpoint (currently unthrottled)
- [ ] Integration tests against a dockerized Supabase
- [ ] Email transactional notifications (Resend)
- [ ] Re-verification workflow at the 5-year SEC limit
- [ ] Cross-jurisdiction license validation (currently trusts the CPA's
      self-reported jurisdiction)
- [ ] Webhook to issuer platforms on letter issuance
- [ ] Dashboard CPA earnings / throughput metrics
- [ ] Internationalization (currently US-only)

---

## 17. Glossary

| Term          | Meaning                                               |
|---------------|-------------------------------------------------------|
| AGI           | Adjusted Gross Income (Form 1040 Line 11)             |
| CRD           | Central Registration Depository (FINRA record)       |
| DI            | Document Intelligence (Azure's OCR service)           |
| DTAA          | Double Taxation Avoidance Agreement                   |
| K-1           | Schedule K-1 (partnership / S-corp income pass-through)|
| MFJ / MFS     | Married Filing Jointly / Separately                   |
| PFIC          | Passive Foreign Investment Company                    |
| Reg D         | Regulation D — the SEC rule exempting private offerings|
| Rule 501(a)   | Definition of "accredited investor"                   |
| Rule 506(c)   | The private-placement rule requiring verified status  |
| RLS           | Row-Level Security (Postgres)                         |
| YTD           | Year-to-Date                                          |
