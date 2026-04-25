/**
 * Per-path document requirements for SEC accreditation.
 *
 * Given a submission + its uploaded documents, this module returns:
 *   - the ordered list of "slots" the customer must fill
 *   - which slot each uploaded document satisfies (if any)
 *   - warnings (wrong tax year, weak evidence, stale date)
 *   - a ready flag telling us if the submission is complete enough to submit
 *
 * The CPA sees the same computed summary, so the admin review page can
 * lead with "here's what the customer provided for each requirement."
 */

import { priorTwoYears, type FilingStatus } from '@/lib/sec-verify'
import type { Submission, Document } from '@/db/schema'

export type RequirementStatus = 'missing' | 'uploaded_pending' | 'uploaded_matched' | 'uploaded_mismatch'

export type RequirementSlot = {
  key: string
  title: string
  description: string
  year?: number
  acceptDocTypes: Document['type'][]
  status: RequirementStatus
  fulfilledBy: Document[]
  note?: string
  severity?: 'info' | 'warning' | 'error'
}

export type VerificationPlan = {
  path: Submission['verificationPath']
  filingStatus: FilingStatus | null
  slots: RequirementSlot[]
  unassignedDocs: Document[]
  ready: boolean
  completion: { filled: number; total: number }
  summary: string
}

export function computePlan(sub: Submission, docs: Document[]): VerificationPlan {
  if (sub.verificationPath === 'income') return incomePlan(sub, docs)
  if (sub.verificationPath === 'net_worth') return netWorthPlan(sub, docs)
  if (sub.verificationPath === 'entity_assets') return entityAssetsPlan(sub, docs)
  if (sub.verificationPath === 'professional') return professionalPlan(sub, docs)
  return {
    path: sub.verificationPath,
    filingStatus: (sub.filingStatus as FilingStatus | null) ?? null,
    slots: [],
    unassignedDocs: docs,
    ready: false,
    completion: { filled: 0, total: 0 },
    summary: 'Pick a verification path to continue.',
  }
}

// ─── Income path ───────────────────────────────────────────────────────

function incomePlan(sub: Submission, docs: Document[]): VerificationPlan {
  const [y1, y2] = priorTwoYears()
  const currentYear = new Date().getUTCFullYear()
  const filingStatus = (sub.filingStatus as FilingStatus | null) ?? null
  const thresholdLabel =
    filingStatus === 'mfj' || filingStatus === 'spousal_equivalent' ? '$300,000/yr' : '$200,000/yr'

  const slots: RequirementSlot[] = []
  const used = new Set<string>()

  // Y1 1040
  slots.push(
    makeYearSlot({
      key: `1040_${y1}`,
      title: `${y1} Form 1040`,
      description: `Tax return for ${y1} (first prior year). AGI must meet ${thresholdLabel}.`,
      year: y1,
      docTypes: ['form_1040'],
      docs,
      used,
    }),
  )

  // Y2 1040
  slots.push(
    makeYearSlot({
      key: `1040_${y2}`,
      title: `${y2} Form 1040`,
      description: `Tax return for ${y2} (most recent filed year). AGI must meet ${thresholdLabel}.`,
      year: y2,
      docTypes: ['form_1040'],
      docs,
      used,
    }),
  )

  // Current-year evidence — either current W-2 or 2 pay stubs
  const currentDocs = docs.filter(
    (d) =>
      !used.has(d.id) &&
      (d.type === 'paystub' || d.type === 'w2') &&
      docYearGuess(d) === currentYear,
  )
  currentDocs.forEach((d) => used.add(d.id))

  const hasW2 = currentDocs.some((d) => d.type === 'w2')
  const payStubCount = currentDocs.filter((d) => d.type === 'paystub').length

  let curStatus: RequirementStatus = 'missing'
  let curNote: string | undefined
  let curSeverity: 'info' | 'warning' | 'error' | undefined
  if (hasW2) {
    curStatus = 'uploaded_matched'
    curNote = `Current-year W-2 on file.`
    curSeverity = 'info'
  } else if (payStubCount >= 2) {
    curStatus = 'uploaded_matched'
    curNote = `${payStubCount} recent pay stubs on file.`
    curSeverity = 'info'
  } else if (payStubCount === 1) {
    curStatus = 'uploaded_pending'
    curNote = 'One pay stub uploaded. Upload one more recent stub (last 60 days) or a current W-2.'
    curSeverity = 'warning'
  } else {
    curStatus = 'missing'
    curNote = 'Upload two recent pay stubs or a current-year W-2 to confirm ongoing income.'
    curSeverity = 'warning'
  }

  slots.push({
    key: `current_${currentYear}`,
    title: `${currentYear} current-year confirmation`,
    description: `Prove your income is on track this year. Two recent pay stubs, or a ${currentYear} W-2.`,
    year: currentYear,
    acceptDocTypes: ['paystub', 'w2'],
    status: curStatus,
    fulfilledBy: currentDocs,
    note: curNote,
    severity: curSeverity,
  })

  // Optional supporting docs — Schedule K-1s, 1099s, or anything else the
  // customer wants the CPA to see when business/partnership income shows up
  // on their 1040. Never required, never blocks the checklist.
  const supportingTypes: Document['type'][] = ['k1', 'other']
  const supportingDocs = docs.filter(
    (d) => !used.has(d.id) && supportingTypes.includes(d.type),
  )
  supportingDocs.forEach((d) => used.add(d.id))
  slots.push({
    key: 'supporting_income',
    title: 'Supporting income docs (optional)',
    description:
      'Schedule K-1s, 1099-NEC/MISC/DIV, employer letters, or any other doc you want the CPA to see.',
    acceptDocTypes: supportingTypes,
    status:
      supportingDocs.length > 0 ? 'uploaded_matched' : 'uploaded_pending',
    fulfilledBy: supportingDocs,
    note:
      supportingDocs.length > 0
        ? `${supportingDocs.length} supporting doc${supportingDocs.length === 1 ? '' : 's'} on file.`
        : 'Add K-1s or 1099s here if business/partnership income is on your 1040.',
    severity: 'info',
  })

  // "filled" counts both confirmed matches AND pending-extraction docs so the
  // customer's progress bar advances as they upload, not only after OCR finishes.
  // Supporting-income slot is optional — excluded from the progress count.
  const requiredSlots = slots.filter((s) => s.key !== 'supporting_income')
  const filled = requiredSlots.filter(
    (s) => s.status === 'uploaded_matched' || s.status === 'uploaded_pending',
  ).length
  const unassigned = docs.filter((d) => !used.has(d.id))

  // "ready" stays strict — only proper matches of required slots count
  const ready = requiredSlots.every((s) => s.status === 'uploaded_matched')

  return {
    path: sub.verificationPath,
    filingStatus,
    slots,
    unassignedDocs: unassigned,
    ready,
    completion: { filled, total: requiredSlots.length },
    summary: `Income path · ${filingStatus ? filingStatus.toUpperCase() : '—'} · Threshold ${thresholdLabel}`,
  }
}

function makeYearSlot(args: {
  key: string
  title: string
  description: string
  year: number
  docTypes: Document['type'][]
  docs: Document[]
  used: Set<string>
}): RequirementSlot {
  const { key, title, description, year, docTypes, docs, used } = args

  // Available candidates of the right type
  const candidates = docs.filter((d) => !used.has(d.id) && docTypes.includes(d.type))

  // 1) Exact-year match (extraction done + year matches)
  const exact = candidates.find((d) => docYearGuess(d) === year)
  if (exact) {
    used.add(exact.id)
    return {
      key,
      title,
      description,
      year,
      acceptDocTypes: docTypes,
      status: 'uploaded_matched',
      fulfilledBy: [exact],
      note: `Matched: ${exact.fileName}`,
      severity: 'info',
    }
  }

  // 2) Doc of right type is still being extracted — don't consume it, don't flag mismatch yet
  const pending = candidates.find(
    (d) =>
      d.extractionStatus === 'pending' ||
      d.extractionStatus === 'in_progress' ||
      (d.extractionStatus === 'done' && docYearGuess(d) == null),
  )
  if (pending) {
    return {
      key,
      title,
      description,
      year,
      acceptDocTypes: docTypes,
      status: 'uploaded_pending',
      fulfilledBy: [pending],
      note: `${pending.fileName} is being analyzed — year will match automatically once OCR finishes.`,
      severity: 'info',
    }
  }

  // 3) Doc of right type, extraction done, but wrong year — true mismatch
  const wrongYear = candidates.find(
    (d) => docYearGuess(d) != null && docYearGuess(d) !== year,
  )
  if (wrongYear) {
    const ey = docYearGuess(wrongYear)
    return {
      key,
      title,
      description,
      year,
      acceptDocTypes: docTypes,
      status: 'uploaded_mismatch',
      fulfilledBy: [wrongYear],
      note: `Uploaded ${wrongYear.fileName} appears to be for ${ey}, not ${year}. Please upload the correct year.`,
      severity: 'warning',
    }
  }

  // 4) Nothing uploaded for this slot
  return {
    key,
    title,
    description,
    year,
    acceptDocTypes: docTypes,
    status: 'missing',
    fulfilledBy: [],
    severity: 'warning',
  }
}

/**
 * Best-effort tax-year guess from a document. Prefers extracted field,
 * falls back to filename. Returns null if unknown.
 *
 * Regex note: we use digit lookarounds instead of \b word boundaries
 * because underscores count as word characters — so `\b(20\d{2})\b`
 * FAILS on "Test_Paystub_2026_Feb.pdf" (no boundary around _2026_).
 * `(?<!\d)(20\d{2})(?!\d)` correctly matches a 4-digit year adjacent
 * to any non-digit char (underscore, dot, space, letter).
 */
function docYearGuess(doc: Document): number | null {
  const raw = doc.rawExtraction as { taxYear?: number } | null
  if (raw && typeof raw.taxYear === 'number') return raw.taxYear

  const match = doc.fileName.match(/(?<!\d)(20\d{2})(?!\d)/)
  if (match) return Number(match[1])
  return null
}

// ─── Net worth path ────────────────────────────────────────────────────

function netWorthPlan(sub: Submission, docs: Document[]): VerificationPlan {
  const slots: RequirementSlot[] = []
  const used = new Set<string>()

  const assetTypes: Document['type'][] = [
    'bank_statement',
    'brokerage_statement',
    'retirement_statement',
    'real_estate',
    'business_ownership',
    'crypto_wallet',
    'life_insurance',
  ]
  const liabTypes: Document['type'][] = [
    'mortgage_statement',
    'credit_card_statement',
    'loan_statement',
  ]

  const assetDocs = docs.filter((d) => assetTypes.includes(d.type))
  const liabDocs = docs.filter((d) => liabTypes.includes(d.type))
  assetDocs.forEach((d) => used.add(d.id))
  liabDocs.forEach((d) => used.add(d.id))

  slots.push({
    key: 'assets',
    title: 'Asset statements',
    description:
      'Recent statements (within 90 days) for all assets: bank, brokerage, retirement, real estate, business interests, crypto, life insurance cash value.',
    acceptDocTypes: assetTypes,
    status:
      assetDocs.length === 0
        ? 'missing'
        : assetDocs.length < 2
        ? 'uploaded_pending'
        : 'uploaded_matched',
    fulfilledBy: assetDocs,
    note:
      assetDocs.length === 0
        ? 'Upload at least one asset statement to start.'
        : `${assetDocs.length} asset statement${assetDocs.length === 1 ? '' : 's'} on file.`,
    severity: assetDocs.length === 0 ? 'warning' : 'info',
  })

  slots.push({
    key: 'liabilities',
    title: 'Liability statements',
    description:
      'Mortgages, auto loans, student loans, credit card balances. Upload all current obligations so the CPA can calculate net worth correctly.',
    acceptDocTypes: liabTypes,
    status: liabDocs.length === 0 ? 'uploaded_pending' : 'uploaded_matched',
    fulfilledBy: liabDocs,
    note:
      liabDocs.length === 0
        ? 'Optional but recommended. If you have no liabilities, skip this.'
        : `${liabDocs.length} liability statement${liabDocs.length === 1 ? '' : 's'} on file.`,
    severity: 'info',
  })

  slots.push({
    key: 'primary_residence',
    title: 'Primary-residence information',
    description:
      'SEC excludes primary residence from net worth. We need FMV + mortgage, plus whether the mortgage changed in the last 60 days.',
    acceptDocTypes: [],
    status: 'uploaded_pending',
    fulfilledBy: [],
    note: 'Fill out the primary-residence form before submitting.',
    severity: 'warning',
  })

  const filled = slots.filter((s) => s.status === 'uploaded_matched').length
  const unassigned = docs.filter((d) => !used.has(d.id))

  const ready = assetDocs.length >= 2

  return {
    path: sub.verificationPath,
    filingStatus: (sub.filingStatus as FilingStatus | null) ?? null,
    slots,
    unassignedDocs: unassigned,
    ready,
    completion: { filled, total: slots.length },
    summary: 'Net-worth path · Threshold $1,000,000 excluding primary residence',
  }
}

// ─── Entity-assets path (Rule 501(a)(3) / 501(a)(7)) ───────────────────
//
// For entities like corporations, partnerships, LLCs, business trusts, or
// 501(c)(3) non-profits to qualify, total assets must exceed $5,000,000 and
// the entity must not have been formed for the specific purpose of investing.

function entityAssetsPlan(sub: Submission, docs: Document[]): VerificationPlan {
  const slots: RequirementSlot[] = []
  const used = new Set<string>()

  const financialsTypes: Document['type'][] = [
    'entity_financials',
    'bank_statement',
    'brokerage_statement',
  ]
  const formationTypes: Document['type'][] = ['entity_formation', 'other']

  const financialDocs = docs.filter(
    (d) => !used.has(d.id) && financialsTypes.includes(d.type),
  )
  financialDocs.forEach((d) => used.add(d.id))
  slots.push({
    key: 'entity_financials',
    title: 'Entity financial statements',
    description:
      'Most recent audited financial statements, or unaudited statements plus recent bank/brokerage statements totaling > $5,000,000 in assets.',
    acceptDocTypes: financialsTypes,
    status:
      financialDocs.length === 0
        ? 'missing'
        : financialDocs.length < 2
          ? 'uploaded_pending'
          : 'uploaded_matched',
    fulfilledBy: financialDocs,
    note:
      financialDocs.length === 0
        ? 'Required: balance sheet or statements showing >$5M in total assets.'
        : `${financialDocs.length} financial statement${financialDocs.length === 1 ? '' : 's'} on file.`,
    severity: financialDocs.length === 0 ? 'warning' : 'info',
  })

  const formationDocs = docs.filter(
    (d) => !used.has(d.id) && formationTypes.includes(d.type),
  )
  formationDocs.forEach((d) => used.add(d.id))
  slots.push({
    key: 'entity_formation',
    title: 'Entity formation / good-standing docs',
    description:
      'Articles of incorporation, operating agreement, or secretary-of-state certificate of good standing.',
    acceptDocTypes: formationTypes,
    status: formationDocs.length > 0 ? 'uploaded_matched' : 'missing',
    fulfilledBy: formationDocs,
    note:
      formationDocs.length > 0
        ? `${formationDocs.length} entity doc${formationDocs.length === 1 ? '' : 's'} on file.`
        : 'Upload one formation or good-standing document.',
    severity: formationDocs.length > 0 ? 'info' : 'warning',
  })

  const supportingDocs = docs.filter(
    (d) => !used.has(d.id) && (d.type === 'k1' || d.type === 'other'),
  )
  supportingDocs.forEach((d) => used.add(d.id))
  slots.push({
    key: 'entity_supporting',
    title: 'Beneficial-owner / supporting docs (optional)',
    description:
      'Beneficial-owner list, K-1s for pass-through members, board resolutions — anything useful for CPA review.',
    acceptDocTypes: ['k1', 'other'],
    status:
      supportingDocs.length > 0 ? 'uploaded_matched' : 'uploaded_pending',
    fulfilledBy: supportingDocs,
    note:
      supportingDocs.length > 0
        ? `${supportingDocs.length} supporting doc${supportingDocs.length === 1 ? '' : 's'} on file.`
        : 'Optional — attach anything the CPA should see.',
    severity: 'info',
  })

  const required = slots.filter((s) => s.key !== 'entity_supporting')
  const filled = required.filter(
    (s) => s.status === 'uploaded_matched' || s.status === 'uploaded_pending',
  ).length
  const ready = required.every((s) => s.status === 'uploaded_matched')
  const unassigned = docs.filter((d) => !used.has(d.id))

  return {
    path: sub.verificationPath,
    filingStatus: (sub.filingStatus as FilingStatus | null) ?? null,
    slots,
    unassignedDocs: unassigned,
    ready,
    completion: { filled, total: required.length },
    summary: 'Entity-assets path · Threshold $5,000,000 in total assets',
  }
}

// ─── Professional-credential path (Rule 501(a)(10)) ────────────────────
//
// An active, in-good-standing FINRA Series 7, 65, or 82 license is
// self-qualifying. The CPA confirms the license is active via BrokerCheck
// or a CRD snapshot.

function professionalPlan(sub: Submission, docs: Document[]): VerificationPlan {
  const slots: RequirementSlot[] = []
  const used = new Set<string>()

  const credentialTypes: Document['type'][] = ['finra_credential', 'other']
  const credDocs = docs.filter(
    (d) => !used.has(d.id) && credentialTypes.includes(d.type),
  )
  credDocs.forEach((d) => used.add(d.id))
  slots.push({
    key: 'finra_credential',
    title: 'FINRA credential',
    description:
      'Active Series 7, 65, or 82 license. Upload a current BrokerCheck PDF or CRD snapshot (within 30 days).',
    acceptDocTypes: credentialTypes,
    status: credDocs.length > 0 ? 'uploaded_matched' : 'missing',
    fulfilledBy: credDocs,
    note:
      credDocs.length > 0
        ? `${credDocs.length} credential doc${credDocs.length === 1 ? '' : 's'} on file.`
        : 'Download your BrokerCheck report from brokercheck.finra.org and upload the PDF.',
    severity: credDocs.length > 0 ? 'info' : 'warning',
  })

  const filled = slots.filter((s) => s.status === 'uploaded_matched').length
  const ready = slots.every((s) => s.status === 'uploaded_matched')
  const unassigned = docs.filter((d) => !used.has(d.id))

  return {
    path: sub.verificationPath,
    filingStatus: (sub.filingStatus as FilingStatus | null) ?? null,
    slots,
    unassignedDocs: unassigned,
    ready,
    completion: { filled, total: slots.length },
    summary: 'Professional-credential path · Series 7 / 65 / 82',
  }
}
