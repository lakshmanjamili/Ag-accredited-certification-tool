/**
 * Routes a document to the correct Azure prebuilt model, runs extraction,
 * and returns a normalized record for persistence + CPA display.
 *
 * We surface EVERY Azure field, not a hand-picked subset. The CPA sees
 * everything the OCR found, with confidence. High-level "key values" like
 * AGI / wages / YTD are also pulled out for aggregation and rule evaluation.
 */

import {
  AZURE_MODELS,
  analyzeDocument,
  fieldToCents,
  fieldToNumber,
  fieldToString,
  maskPII,
  type AzureModelId,
  type FieldValue,
  type DocumentAnalysis,
} from './azure-di'
import type { documentTypeEnum } from '@/db/schema'

type DocumentType = (typeof documentTypeEnum.enumValues)[number]

const MODEL_ROUTING: Partial<Record<DocumentType, AzureModelId>> = {
  form_1040: AZURE_MODELS.form_1040,
  w2: AZURE_MODELS.w2,
  paystub: AZURE_MODELS.paystub,
  k1: AZURE_MODELS.layout, // no dedicated prebuilt — layout OCR
  bank_statement: AZURE_MODELS.bank_statement,
  brokerage_statement: AZURE_MODELS.bank_statement, // closest prebuilt
  retirement_statement: AZURE_MODELS.bank_statement, // closest prebuilt
  mortgage_statement: AZURE_MODELS.layout,
  credit_card_statement: AZURE_MODELS.bank_statement,
  loan_statement: AZURE_MODELS.layout,
  real_estate: AZURE_MODELS.layout,
  business_ownership: AZURE_MODELS.layout,
  crypto_wallet: AZURE_MODELS.layout,
  life_insurance: AZURE_MODELS.layout,
  entity_financials: AZURE_MODELS.layout,
  entity_formation: AZURE_MODELS.layout,
  finra_credential: AZURE_MODELS.layout,
  other: AZURE_MODELS.layout,
}

export type CpaDisplayField = {
  label: string
  value: string | null
  confidence: number | null
  highlight?: boolean
  raw?: FieldValue
}

export type NormalizedExtraction = {
  modelUsed: AzureModelId | null
  fallbackUsed: boolean
  docType: string | undefined
  confidence: number | null
  /** Compact key/value pairs for aggregation (amounts in cents, dates as ISO) */
  keyValues: Record<string, unknown>
  /** Every Azure-extracted field, labeled + confidence-stamped, PII-masked, for CPA display */
  displayFields: CpaDisplayField[]
  rawTextPreview: string | null
  pageCount: number | null
  error?: string
}

export async function extractDocument(
  type: DocumentType,
  fileBuffer: ArrayBuffer,
): Promise<NormalizedExtraction> {
  const modelId = MODEL_ROUTING[type] ?? AZURE_MODELS.layout

  const analysis = await analyzeDocument(modelId, fileBuffer)

  return {
    modelUsed: analysis.modelUsed,
    fallbackUsed: analysis.fallbackUsed,
    docType: analysis.docType,
    confidence: analysis.confidence,
    keyValues: deriveKeyValues(type, analysis),
    displayFields: buildDisplayFields(analysis),
    rawTextPreview: analysis.rawText ? analysis.rawText.slice(0, 2000) : null,
    pageCount: analysis.pageCount,
    error: analysis.error,
  }
}

// ─── Per-model key-value extraction (feeds sec-verify aggregation) ─────

function deriveKeyValues(type: DocumentType, a: DocumentAnalysis): Record<string, unknown> {
  const f = a.fields
  const out: Record<string, unknown> = {}

  if (type === 'form_1040') {
    // AGI — Line 11 on modern 1040. Azure returns it under many names.
    out.agiCents = fieldToCents(
      findField(f, [
        /^AdjustedGrossIncome$/i,
        /^adjustedGrossIncome$/i,
        /^AGI$/i,
        /Line\s*0?11\b/i,
        /^Box\s*0?11a?$/i,
      ]),
    )

    out.taxYear = parseYear(
      fieldToString(findField(f, [/^TaxYear$/i, /^Year$/i, /TaxFormYear/i])),
    )

    out.filingStatus = normalizeFilingStatus(
      fieldToString(findField(f, [/^FilingStatus$/i, /filing_?status/i])),
    )

    // Primary filer name parts (Line 1a first+MI, Line 1b last).
    const firstName = fieldToString(
      findField(f, [/^(Taxpayer)?FirstName$/i, /^First$/i, /FirstName$/i]),
    )
    const middleInitial = fieldToString(
      findField(f, [/^(Taxpayer)?MiddleInitial$/i, /MiddleInitial$/i, /^Middle$/i]),
    )
    const lastName = fieldToString(
      findField(f, [/^(Taxpayer)?LastName$/i, /LastName$/i, /^Last$/i]),
    )
    const taxpayerField =
      fieldToString(findField(f, [/^Taxpayer$/i, /^TaxpayerName$/i])) ?? null

    // Spouse name parts (only for joint/MFS/QSS filing).
    const spouseFirst = fieldToString(findField(f, [/^Spouse.*First/i]))
    const spouseMiddle = fieldToString(findField(f, [/^Spouse.*Middle/i]))
    const spouseLast = fieldToString(findField(f, [/^Spouse.*Last/i]))
    const spouseField = fieldToString(findField(f, [/^Spouse$/i, /^SpouseName$/i]))

    const primary = joinName(firstName, middleInitial, lastName) ?? taxpayerField
    const spouse = joinName(spouseFirst, spouseMiddle, spouseLast) ?? spouseField
    // For the letter we render first + last only to match the AG FinTax
    // vendor template ("John & Jane Doe", not "John M & Jane M Doe").
    const primaryForLetter =
      joinName(firstName, null, lastName) ?? primary
    const spouseForLetter = joinName(spouseFirst, null, spouseLast) ?? spouse

    out.firstName = firstName
    out.middleInitial = middleInitial
    out.lastName = lastName
    out.spouseFirstName = spouseFirst
    out.spouseLastName = spouseLast
    out.taxpayerName = primary
    out.spouseName = spouse
    // Combined name for the letter: "John Doe" or "John & Jane Doe"
    out.investorName = combinedInvestorName(primaryForLetter, spouseForLetter)

    // Address — "STREET, CITY, STATE ZIP" → line1 = street, line2 = "CITY, STATE ZIP".
    const addrRaw = fieldToString(
      findField(f, [
        /^Taxpayer?Address$/i,
        /^Address$/i,
        /^Home(Address)?$/i,
        /Address$/,
      ]),
    )
    if (addrRaw) {
      const [line1, line2] = splitFullAddress(addrRaw)
      out.addressRaw = addrRaw
      out.investorAddressLine1 = line1
      out.investorAddressLine2 = line2
    }

    out.totalIncomeCents = fieldToCents(f.TotalIncome)
    out.taxableIncomeCents = fieldToCents(f.TaxableIncome)
  } else if (type === 'w2') {
    out.wagesCents = fieldToCents(f.WagesTipsAndOtherCompensation ?? f.Box1_Wages)
    out.taxYear = parseYear(fieldToString(f.TaxYear))
    out.employer = fieldToString(f.Employer) ?? fieldToString(f.EmployerName)
    out.employee = fieldToString(f.Employee) ?? fieldToString(f.EmployeeName)
    out.ssWagesCents = fieldToCents(f.SocialSecurityWages)
    out.medicareWagesCents = fieldToCents(f.MedicareWagesAndTips)
    out.fedTaxWithheldCents = fieldToCents(f.FederalIncomeTaxWithheld)
  } else if (type === 'paystub') {
    const gross = fieldToCents(f.CurrentPeriodGrossPay ?? f.GrossPayCurrentPeriod)
    const ytd = fieldToCents(f.YearToDateGrossEarnings ?? f.GrossPayYTD)
    const period = fieldToString(f.PayPeriod)
    const month = new Date().getUTCMonth() + 1
    let annualized: number | null = null
    if (ytd != null && month > 0) annualized = Math.round((ytd * 12) / month)
    else if (gross != null) annualized = Math.round(gross * periodMultiplier(period))

    out.grossCents = gross
    out.ytdCents = ytd
    out.annualizedCents = annualized
    out.payPeriod = period
    out.employer = fieldToString(f.EmployerName)
    out.payDate = fieldToString(f.PayDate)
  } else if (type === 'k1') {
    // Schedule K-1 has no Azure prebuilt model — we run layout OCR and pull
    // the common numeric fields out by fuzzy name match for aggregation.
    out.taxYear = parseYear(
      fieldToString(findField(f, [/^TaxYear$/i, /^Year$/i])),
    )
    out.entityName = fieldToString(
      findField(f, [/^EntityName$/i, /^Partnership/i, /^Corp/i]),
    )
    out.ein = fieldToString(findField(f, [/^EIN$/i, /Employer.*Identification/i]))
    out.ordinaryIncomeCents = fieldToCents(
      findField(f, [/OrdinaryIncome/i, /OrdinaryBusinessIncome/i, /Line\s*1\b/i]),
    )
    out.netRentalIncomeCents = fieldToCents(
      findField(f, [/RentalIncome/i, /NetRentalRealEstate/i, /Line\s*2\b/i]),
    )
    out.guaranteedPaymentsCents = fieldToCents(
      findField(f, [/GuaranteedPayments/i, /Line\s*4\b/i]),
    )
  } else if (
    type === 'bank_statement' ||
    type === 'brokerage_statement' ||
    type === 'retirement_statement'
  ) {
    out.endingBalanceCents = fieldToCents(f.EndingBalance)
    out.beginningBalanceCents = fieldToCents(f.BeginningBalance)
    out.accountHolder = fieldToString(f.AccountHolderName) ?? fieldToString(f.AccountHolder)
    out.statementStart = fieldToString(f.StatementStartDate)
    out.statementEnd = fieldToString(f.StatementEndDate)
    out.bankName = fieldToString(f.BankName)
  }

  out.avgConfidence = a.confidence ?? null
  if (a.fallbackUsed) out.modelFallback = 'prebuilt-layout'

  return out
}

// ─── Build the "show the CPA everything" list ──────────────────────────

function buildDisplayFields(a: DocumentAnalysis): CpaDisplayField[] {
  const results: CpaDisplayField[] = []
  const highlightKeys = new Set([
    'AdjustedGrossIncome',
    'WagesTipsAndOtherCompensation',
    'YearToDateGrossEarnings',
    'CurrentPeriodGrossPay',
    'EndingBalance',
    'TaxYear',
    'FilingStatus',
  ])

  for (const [name, field] of Object.entries(a.fields)) {
    const label = humanize(name)
    const value = displayValue(field)
    results.push({
      label,
      value,
      confidence: field.confidence ?? null,
      highlight: highlightKeys.has(name),
      raw: field,
    })
  }

  // Sort: highlighted first, then by label
  results.sort((a, b) => {
    if (a.highlight !== b.highlight) return a.highlight ? -1 : 1
    return a.label.localeCompare(b.label)
  })
  return results
}

function displayValue(f: FieldValue): string | null {
  if (f.kind === 'currency')
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: f.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(f.cents / 100)
  if (f.kind === 'number' || f.kind === 'integer') {
    if (Number.isFinite(f.value))
      return new Intl.NumberFormat('en-US').format(f.value)
    return null
  }
  if (f.kind === 'string' || f.kind === 'text') return maskPII(f.value)
  if (f.kind === 'date') return f.value
  if (f.kind === 'address') return maskPII(f.value)
  if (f.kind === 'array')
    return f.items
      .map((i) => displayValue(i) ?? '')
      .filter(Boolean)
      .join(', ')
  if (f.kind === 'object')
    return Object.entries(f.fields)
      .map(([k, v]) => `${humanize(k)}: ${displayValue(v) ?? '—'}`)
      .join('; ')
  return null
}

function humanize(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function parseYear(s: string | null): number | null {
  if (!s) return null
  const m = s.match(/\b(19|20)\d{2}\b/)
  if (m) return Number(m[0])
  const n = Number(s)
  return Number.isFinite(n) && n > 1900 && n < 2200 ? n : null
}

function normalizeFilingStatus(s: string | null): string | null {
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower.includes('joint')) return 'mfj'
  if (lower.includes('separately')) return 'mfs'
  if (lower.includes('head')) return 'hoh'
  if (lower.includes('surviv')) return 'qss'
  if (lower.includes('single')) return 'single'
  return s
}

function periodMultiplier(p: string | null): number {
  if (!p) return 52
  const l = p.toLowerCase()
  if (l.includes('week')) return 52
  if (l.includes('bi')) return 26
  if (l.includes('semi')) return 24
  if (l.includes('month')) return 12
  return 52
}

// ─── Fuzzy field + name/address helpers ────────────────────────────────

/**
 * Look up an Azure field by trying each pattern against the field map's keys.
 * Azure DI's tax models return wildly inconsistent key names across SKUs
 * (e.g. `AdjustedGrossIncome` vs `Box11` vs `Line11`), so we cast a wide net.
 */
function findField(
  fields: Record<string, FieldValue>,
  patterns: RegExp[],
): FieldValue | undefined {
  const keys = Object.keys(fields)
  for (const re of patterns) {
    const hit = keys.find((k) => re.test(k))
    if (hit) return fields[hit]
  }
  return undefined
}

function joinName(
  first: string | null | undefined,
  middle: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const parts = [first, middle, last].map((p) => (p ?? '').trim()).filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Build the combined name shown on the letter. Joint filers are rendered as
 * "John & Jane Doe" when the two share a surname, else "John Doe & Jane Roe".
 */
function combinedInvestorName(
  primary: string | null | undefined,
  spouse: string | null | undefined,
): string | null {
  const p = (primary ?? '').trim()
  const s = (spouse ?? '').trim()
  if (!p && !s) return null
  if (!s) return p
  if (!p) return s
  const primaryParts = p.split(/\s+/)
  const spouseParts = s.split(/\s+/)
  const pLast = primaryParts.at(-1)
  const sLast = spouseParts.at(-1)
  if (pLast && sLast && pLast.toLowerCase() === sLast.toLowerCase()) {
    const pFirst = primaryParts.slice(0, -1).join(' ')
    const sFirst = spouseParts.slice(0, -1).join(' ')
    return `${pFirst} & ${sFirst} ${pLast}`.replace(/\s+/g, ' ').trim()
  }
  return `${p} & ${s}`
}

/**
 * Split "123 Main St, Frisco, TX 75035" (and minor variants) into two
 * letter-ready lines: the street, and the remaining "CITY, STATE ZIP".
 * Falls back to returning the whole string on line 1 if we can't parse it.
 */
function splitFullAddress(raw: string): [string, string] {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  const segs = cleaned.split(/\s*,\s*/).filter(Boolean)
  if (segs.length >= 3) {
    const line1 = segs[0]
    const line2 = segs.slice(1, 3).join(', ').replace(/,\s*USA?$/i, '').trim()
    return [line1, line2]
  }
  if (segs.length === 2) return [segs[0], segs[1]]
  return [cleaned, '']
}

// Re-exports for callers still using the old API surface
void fieldToNumber
export { fieldToCents, fieldToString, fieldToNumber, maskPII }
