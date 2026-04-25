/**
 * Maps investor + verification data to the bracket placeholders used in the
 * AG-FinTax verification letter DOCX template. Ported from the prior vendor
 * prototype — the template's literal-bracket approach (`[John & Jane Doe]`)
 * is brittle but it preserves Word formatting, embedded logo, and legal wording.
 */

export type LetterPath =
  | 'income'
  | 'net_worth'
  | 'professional'
  | 'entity_assets'

export type LetterData = {
  investorName: string
  investorAddressLine1: string | null
  investorAddressLine2: string | null
  /** For "Dear Mr./Mrs." rendering */
  salutationTitle?: string | null
  taxYearPrimary: number | null
  taxYearSecondary: number | null
  path: LetterPath
  certificateNumber: string
  issuedAt: Date
  validThrough: Date
}

export type PlaceholderMap = Record<string, string>

/**
 * Template checkbox order (7 boxes):
 *   0 → net worth (Rule 501(a)(5))
 *   1 → income ($200k / $300k — Rule 501(a)(6))
 *   2 → individual retirement account
 *   3 → employee benefits plan
 *   4 → corporation / partnership  (501(a)(3), (7))
 *   5 → business / entity / trust  (501(a)(8))
 *   6 → bank / insurance           (501(a)(1))
 */
export const CHECKBOX_BY_PATH: Record<LetterPath, number> = {
  net_worth: 0,
  income: 1,
  professional: 1, // the template has no dedicated "professional license" box; nearest is income
  entity_assets: 5,
}

export function getCheckboxIndex(path: LetterPath): number {
  return CHECKBOX_BY_PATH[path] ?? 1
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatSalutation(name: string, title?: string | null): string {
  if (name.includes('&')) {
    const [a, b] = name.split('&').map((p) => p.trim())
    const firstA = a.split(/\s+/)[0] ?? ''
    const firstB = b ? b.split(/\s+/)[0] : ''
    return `Dear Mr. ${firstA} & Mrs. ${firstB},`
  }
  const first = name.split(/\s+/)[0] ?? name
  if (title) return `Dear ${title} ${first},`
  return `Dear ${first},`
}

/**
 * The vendor template uses "[8195 Custer Rd]" for line1 and
 * "[Frisco, TX 75035]" for line2. Fall back to blanks (never placeholder
 * text) when we don't have data — a blank letter is better than a letter
 * that renders "Address Line 1" as its header.
 */
export function splitAddress(a: string | null, b: string | null): [string, string] {
  return [a?.trim() ?? '', b?.trim() ?? '']
}

/** Build the exact placeholder → value map the template expects. */
export function mapPlaceholders(data: LetterData): PlaceholderMap {
  const [line1, line2] = splitAddress(data.investorAddressLine1, data.investorAddressLine2)
  const salutation = formatSalutation(data.investorName, data.salutationTitle)
  const y1 = data.taxYearPrimary
    ? String(data.taxYearPrimary)
    : String(new Date().getUTCFullYear() - 1)
  const y2 = data.taxYearSecondary
    ? String(data.taxYearSecondary)
    : String(new Date().getUTCFullYear() - 2)

  return {
    // Date
    '[November 10th, 2025]': formatLongDate(data.issuedAt),

    // Investor name (template has both bracketed + inline)
    '[John & Jane Doe]': data.investorName,
    'John & Jane Doe': data.investorName,

    // Address
    '[8195 Custer Rd]': line1,
    '[Frisco, TX 75035]': line2,

    // Salutation
    'Dear [Mr. John & Mrs. Jane],': salutation,

    // Tax years
    '[2024]': y1,
    '[2023]': y2,
  }
}
