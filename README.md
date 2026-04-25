# AgFinTax Accreditation Tool

SEC-compliant accredited investor verification with human-in-the-loop CPA review and branded PDF/DOCX certificates.

## Stack

- **Framework:** Next.js 16 · App Router · React 19 · TypeScript
- **Auth + DB + Storage + Email:** Supabase (single provider)
- **ORM:** Drizzle
- **OCR:** Azure Document Intelligence (`prebuilt-tax.us.1040`, `prebuilt-tax.us.w2`, `prebuilt-payStub.us`, `prebuilt-bankStatement`)
- **UI:** Tailwind v4 + shadcn/ui *new-york*, Plus Jakarta Sans, brand navy `#03045e` + orange `#ff6600`
- **Certificates:** `pdf-lib` (AcroForm fill) + `docxtemplater` (DOCX)
- **E-signature:** `signature_pad` (draw-pad per certificate)

## Personas

- **Investor** — uploads 1040s / W-2 / pay stubs / net-worth docs, sees status, downloads certificate after approval.
- **CPA (admin)** — claims queue items, reviews human-in-the-loop, approves / rejects / requests changes, draws signature.

## Verification paths (SEC Rule 501(a))

| Path | Threshold | Evidence |
|---|---|---|
| Individual income | $200,000 × 2 yrs + current-year confirmation | 2 × 1040, recent pay stubs or W-2 |
| Joint income | $300,000 × 2 yrs + current-year confirmation | 2 × 1040 (MFJ), recent pay stubs or W-2 |
| Net worth | $1,000,000 excluding primary residence | Bank, brokerage, retirement, mortgage, loan statements |

Thresholds enforced exactly — no buffers. Avg OCR confidence < 0.6 → auto-escalates to manual review.

## Local setup

1. `cp .env.example .env.local` — fill Supabase + Azure values.
2. `npm install`.
3. In Supabase dashboard → Storage → create **private** bucket `accreditation-docs`.
4. In Supabase dashboard → Auth → Email Templates — brand "Confirm signup", "Magic Link", and "Reset Password" with AgFinTax navy/orange styling.
5. `npm run db:push` — applies the Drizzle schema.
6. `npm run db:rls` (or paste `supabase/rls.sql` into Supabase SQL editor) — enables RLS + the auth→profile trigger.
7. `npm run db:seed` — creates a demo customer and two demo admins (Anil Grandhi CPA, Review CPA). Passwords printed in the script.
8. `npm run dev`.

### Demo credentials

| Email | Password | Role |
|---|---|---|
| demo.customer@agfintax.dev | Demo12345! | customer |
| anil.cpa@agfintax.dev | Demo12345! | admin (CPA) |
| review.cpa@agfintax.dev | Demo12345! | admin (CPA) |

## Scripts

| Command | Purpose |
|---|---|
| `dev` | Next.js dev server |
| `build` | Production build |
| `typecheck` | TS check only |
| `lint` | ESLint |
| `db:push` | Apply schema to dev DB |
| `db:generate` | Generate SQL migration from schema |
| `db:migrate` | Apply generated migrations (prod) |
| `db:rls` | Apply RLS policies + auth sync trigger from `supabase/rls.sql` |
| `db:seed` | Seed demo customer + 2 admins |
| `test` | Vitest |

## Routes

| Path | Role |
|---|---|
| `/` | public |
| `/sign-in`, `/sign-up` | public |
| `/dashboard`, `/verify`, `/letter`, `/profile` | customer |
| `/admin`, `/admin/queue`, `/admin/submissions/[id]`, `/admin/profile` | admin |
| `/verify-public/[certNumber]` | public (issuer-facing) |

## Project structure

```
src/
  app/                  Route groups + pages
  components/ui/        shadcn primitives
  components/customer/  Investor-side components
  components/admin/     CPA-side components
  components/shared/    Cross-role components
  db/                   Drizzle schema + client
  lib/                  Core libs (sec-verify, extraction, azure-di, letter)
  lib/supabase/         Browser + server + middleware clients
  lib/zod/              Input schemas
templates/              DOCX + PDF certificate templates
drizzle/                Generated migrations
scripts/                Seed + maintenance scripts
tests/                  Vitest suites
```
