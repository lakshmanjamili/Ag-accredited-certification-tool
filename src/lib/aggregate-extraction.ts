/**
 * Aggregates raw Azure DI extractions across a submission's documents into
 * the inputs shape expected by sec-verify.ts, and returns per-doc summaries
 * for display.
 *
 * Strategy:
 *   - group by tax year (from rawExtraction.taxYear, falling back to filename)
 *   - for each prior year keep the highest-confidence 1040 AGI
 *   - for current year: prefer 2× pay stub annualized (avg), else current-year W-2
 *   - average confidence across used docs
 *   - filter out rejected / failed extractions
 */

import type { Document, Submission } from '@/db/schema'
import type { FilingStatus, VerificationInputs } from '@/lib/sec-verify'
import { priorTwoYears } from '@/lib/sec-verify'

export type ExtractedSummary = {
  documentId: string
  fileName: string
  type: Document['type']
  extractionStatus: string
  confidence: number | null
  taxYear: number | null
  fields: Array<{
    label: string
    value: string
    highlight?: boolean
    confidence?: number | null
  }>
  /** Raw layout text when Azure couldn't match a specialized model */
  textPreview?: string | null
  fallbackUsed?: boolean
  azureModelId?: string | null
  docType?: string | null
}

export type AggregatedInputs = {
  inputs: VerificationInputs | null
  summaries: ExtractedSummary[]
  usedYears: { y1: number; y2: number; current: number }
}

export function aggregateForReview(sub: Submission, docs: Document[]): AggregatedInputs {
  const [y1, y2] = priorTwoYears()
  const currentYear = new Date().getUTCFullYear()
  const summaries = docs.map((d) => summarizeDoc(d, { y1, y2, currentYear }))

  if (sub.verificationPath === 'income') {
    const inputs = buildIncomeInputs(sub, docs, { y1, y2, currentYear })
    return { inputs, summaries, usedYears: { y1, y2, current: currentYear } }
  }
  if (sub.verificationPath === 'net_worth') {
    // Net worth aggregation lives in CPA line-item table; keep null here.
    return { inputs: null, summaries, usedYears: { y1, y2, current: currentYear } }
  }
  return { inputs: null, summaries, usedYears: { y1, y2, current: currentYear } }
}

function summarizeDoc(
  d: Document,
  years: { y1: number; y2: number; currentYear: number },
): ExtractedSummary {
  const raw = (d.rawExtraction ?? {}) as Record<string, unknown>
  const confidence =
    typeof d.confidence === 'string' ? Number(d.confidence) : (d.confidence as number | null)

  const taxYear = pickYear(raw, d.fileName)
  const fields: Array<{
    label: string
    value: string
    highlight?: boolean
    confidence?: number | null
  }> = []

  // Prefer Azure's rich display-fields if the new extractor populated them
  const richFields = Array.isArray(raw.__displayFields)
    ? (raw.__displayFields as Array<{
        label: string
        value: string | null
        confidence: number | null
        highlight?: boolean
      }>)
    : null

  if (richFields && richFields.length > 0) {
    for (const f of richFields) {
      if (f.value != null) {
        fields.push({
          label: f.label,
          value: f.value,
          highlight: f.highlight,
          confidence: f.confidence,
        })
      }
    }
    const textPreview =
      typeof raw.__textPreview === 'string' ? (raw.__textPreview as string) : null
    const fallbackUsed = raw.__fallback === true
    const azureModelId = d.azureModelId ?? null
    const docType = typeof raw.__docType === 'string' ? (raw.__docType as string) : null

    if (d.type === 'form_1040' && taxYear != null) {
      const expected = taxYear === years.y1 || taxYear === years.y2
      if (!expected) {
        fields.push({
          label: 'Year match',
          value: `Unexpected ${taxYear}; expected ${years.y1} or ${years.y2}`,
        })
      }
    }

    return {
      documentId: d.id,
      fileName: d.fileName,
      type: d.type,
      extractionStatus: d.extractionStatus,
      confidence,
      taxYear,
      fields,
      textPreview,
      fallbackUsed,
      azureModelId,
      docType,
    }
  }

  if (d.type === 'form_1040') {
    const agiCents = toNumber(raw.agiCents)
    if (agiCents != null)
      fields.push({ label: 'AGI', value: formatCurrency(agiCents), highlight: true })
    if (taxYear != null) fields.push({ label: 'Tax year', value: String(taxYear) })
    const fs = toString(raw.filingStatus)
    if (fs) fields.push({ label: 'Filing status', value: fs })
  } else if (d.type === 'w2') {
    const wagesCents = toNumber(raw.wagesCents)
    if (wagesCents != null)
      fields.push({ label: 'Wages', value: formatCurrency(wagesCents), highlight: true })
    if (taxYear != null) fields.push({ label: 'Tax year', value: String(taxYear) })
  } else if (d.type === 'paystub') {
    const annual = toNumber(raw.annualizedCents)
    const ytd = toNumber(raw.ytdCents)
    const gross = toNumber(raw.grossCents)
    if (annual != null)
      fields.push({ label: 'Annualized', value: formatCurrency(annual), highlight: true })
    if (ytd != null) fields.push({ label: 'YTD gross', value: formatCurrency(ytd) })
    if (gross != null) fields.push({ label: 'Current period', value: formatCurrency(gross) })
  } else if (
    d.type === 'bank_statement' ||
    d.type === 'brokerage_statement' ||
    d.type === 'retirement_statement'
  ) {
    const bal = toNumber(raw.endingBalanceCents)
    if (bal != null)
      fields.push({ label: 'Ending balance', value: formatCurrency(bal), highlight: true })
  }

  if (fields.length === 0 && d.extractionStatus !== 'done') {
    fields.push({
      label: 'Status',
      value:
        d.extractionStatus === 'pending'
          ? 'Queued for extraction…'
          : d.extractionStatus === 'in_progress'
          ? 'Extracting…'
          : d.extractionStatus === 'failed'
          ? d.errorMessage ?? 'Extraction failed'
          : '—',
    })
  }

  // Year-match indicator
  if (d.type === 'form_1040' && taxYear != null) {
    const expectedYear = taxYear === years.y1 ? years.y1 : taxYear === years.y2 ? years.y2 : null
    if (!expectedYear) {
      fields.push({
        label: 'Year match',
        value: `Unexpected ${taxYear}; expected ${years.y1} or ${years.y2}`,
      })
    }
  }

  return {
    documentId: d.id,
    fileName: d.fileName,
    type: d.type,
    extractionStatus: d.extractionStatus,
    confidence,
    taxYear,
    fields,
  }
}

function buildIncomeInputs(
  sub: Submission,
  docs: Document[],
  years: { y1: number; y2: number; currentYear: number },
): VerificationInputs {
  const { y1, y2, currentYear } = years
  const forms = docs.filter((d) => d.type === 'form_1040' && d.extractionStatus === 'done')
  const paystubs = docs.filter((d) => d.type === 'paystub' && d.extractionStatus === 'done')
  const w2s = docs.filter((d) => d.type === 'w2' && d.extractionStatus === 'done')

  const agiFor = (year: number): { cents: number | null; conf: number | null } => {
    const candidates = forms
      .map((d) => {
        const raw = d.rawExtraction as { agiCents?: number; taxYear?: number } | null
        const yr = raw?.taxYear ?? pickYear(raw ?? {}, d.fileName)
        return { d, raw, yr, agi: toNumber(raw?.agiCents), conf: toNumber(d.confidence) }
      })
      .filter((x) => x.yr === year && x.agi != null)
      .sort((a, b) => (b.conf ?? 0) - (a.conf ?? 0))
    if (candidates.length === 0) return { cents: null, conf: null }
    return { cents: candidates[0].agi, conf: candidates[0].conf }
  }

  const { cents: y1Agi, conf: y1Conf } = agiFor(y1)
  const { cents: y2Agi, conf: y2Conf } = agiFor(y2)

  // Current year — prefer average of pay stubs, else highest-confidence current-year W-2
  const currentPayStubs = paystubs
    .map((d) => {
      const raw = d.rawExtraction as { annualizedCents?: number } | null
      return { d, cents: toNumber(raw?.annualizedCents), conf: toNumber(d.confidence) }
    })
    .filter((x) => x.cents != null)

  const currentW2 = w2s
    .map((d) => {
      const raw = d.rawExtraction as { wagesCents?: number; taxYear?: number } | null
      const yr = raw?.taxYear ?? pickYear(raw ?? {}, d.fileName)
      return { d, cents: toNumber(raw?.wagesCents), conf: toNumber(d.confidence), yr }
    })
    .filter((x) => x.cents != null && x.yr === currentYear)

  let year3PayStubAnnualizedCents: number | null = null
  let year3W2Cents: number | null = null
  let currentConf: number | null = null

  if (currentPayStubs.length > 0) {
    const avg =
      currentPayStubs.reduce((s, x) => s + (x.cents ?? 0), 0) / currentPayStubs.length
    year3PayStubAnnualizedCents = Math.round(avg)
    currentConf =
      currentPayStubs.reduce((s, x) => s + (x.conf ?? 0), 0) / currentPayStubs.length
  }
  if (currentW2.length > 0) {
    currentW2.sort((a, b) => (b.conf ?? 0) - (a.conf ?? 0))
    year3W2Cents = currentW2[0].cents ?? null
    currentConf = currentConf ?? currentW2[0].conf
  }

  const confidences = [y1Conf, y2Conf, currentConf].filter((c): c is number => c != null)
  const avgConfidence =
    confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : null

  return {
    path: 'income',
    filingStatus: (sub.filingStatus as FilingStatus | null) ?? 'single',
    year1AgiCents: y1Agi,
    year2AgiCents: y2Agi,
    year3PayStubAnnualizedCents,
    year3W2Cents,
    avgConfidence,
  }
}

// ─── helpers ───────────────────────────────────────────────────────────

function toNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function pickYear(raw: Record<string, unknown>, fileName: string): number | null {
  const fromRaw = toNumber(raw.taxYear)
  if (fromRaw) return Math.round(fromRaw)
  // `\b` boundaries don't fire around underscores (underscore is a word char),
  // so "Test_Paystub_2026_Feb.pdf" fails a `\b(20\d{2})\b` match. Use digit
  // lookarounds to catch 4-digit years regardless of the surrounding punctuation.
  const match = fileName.match(/(?<!\d)(20\d{2})(?!\d)/)
  return match ? Number(match[1]) : null
}

function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
