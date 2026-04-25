/**
 * SEC Rule 501(a) verification engine.
 *
 * Ported from the prior accredited-certification-tool. Thresholds enforced
 * exactly — no buffers. Business logic documented inline.
 *
 * TODO(sec-review #5): Part-3 "current-year pay stub" — SEC guidance says
 *   reasonable-expectation confirmation is required. Our historical logic
 *   approved without it when prior years were strong. Preserving historical
 *   behavior for now; flag for CPA panel discussion.
 * TODO(sec-review #6): April-1 tax-year cutoff for selecting prior years
 *   is coarse. SEC points to "two most recent years" as filed — revisit
 *   once we support mid-filing-season submissions.
 */

import { SEC_THRESHOLDS, CONFIDENCE_ESCALATION_THRESHOLD } from '@/lib/constants'

export type FilingStatus =
  | 'single'
  | 'mfj'
  | 'mfs'
  | 'hoh'
  | 'qss'
  | 'spousal_equivalent'

export type VerificationPath = 'income' | 'net_worth' | 'professional' | 'entity_assets'

export type RuleStatus = 'approved' | 'rejected' | 'manual_review'

export type RuleReason = {
  code: string
  message: string
  severity: 'info' | 'warning' | 'error'
}

export type IncomeInputs = {
  path: 'income'
  filingStatus: FilingStatus
  year1AgiCents: number | null
  year2AgiCents: number | null
  year3PayStubAnnualizedCents: number | null
  year3W2Cents: number | null
  avgConfidence: number | null
}

export type NetWorthInputs = {
  path: 'net_worth'
  assetsCents: number
  liabilitiesCents: number
  primaryResidenceExcessCents: number
  mortgageChanged60d: boolean
  avgConfidence: number | null
}

export type EntityAssetsInputs = {
  path: 'entity_assets'
  totalAssetsCents: number
  entityType: 'corporation' | 'llc' | 'trust' | 'partnership' | 'fund' | 'nonprofit' | 'other'
  formedForThisInvestment: boolean
  avgConfidence: number | null
}

export type VerificationInputs = IncomeInputs | NetWorthInputs | EntityAssetsInputs

export type VerificationResult = {
  status: RuleStatus
  path: VerificationPath
  threshold: number
  computed: {
    incomeY1?: number | null
    incomeY2?: number | null
    incomeY3Est?: number | null
    netWorth?: number
    payStubConfirmed?: boolean
  }
  reasons: RuleReason[]
  avgConfidence: number | null
}

/** Income threshold in cents for a given filing status. */
export function incomeThresholdCents(filing: FilingStatus): number {
  if (filing === 'mfj' || filing === 'spousal_equivalent') {
    return SEC_THRESHOLDS.JOINT_INCOME_CENTS
  }
  return SEC_THRESHOLDS.INDIVIDUAL_INCOME_CENTS
}

/**
 * Returns the two prior tax years given a reference date, using an April-1
 * cutoff. Before April 1 of year Y → [Y-3, Y-2]; on/after → [Y-2, Y-1].
 */
export function priorTwoYears(today = new Date()): [number, number] {
  const y = today.getUTCFullYear()
  const beforeApril = today.getUTCMonth() < 3 // Jan (0) / Feb (1) / Mar (2)
  return beforeApril ? [y - 3, y - 2] : [y - 2, y - 1]
}

export function evaluate(inputs: VerificationInputs): VerificationResult {
  if (inputs.path === 'income') return evaluateIncome(inputs)
  if (inputs.path === 'net_worth') return evaluateNetWorth(inputs)
  return evaluateEntityAssets(inputs)
}

function evaluateEntityAssets(i: EntityAssetsInputs): VerificationResult {
  const threshold = SEC_THRESHOLDS.ENTITY_ASSETS_CENTS
  const reasons: RuleReason[] = []

  // 501(a)(9) explicitly excludes entities formed for the specific purpose of acquiring the offering
  if (i.formedForThisInvestment) {
    reasons.push({
      code: 'ENTITY_FORMED_FOR_PURPOSE',
      message:
        'Entity was formed specifically to acquire this offering. Rule 501(a)(9) disqualifies this path. Try 501(a)(8) with all-accredited owners, or switch path.',
      severity: 'error',
    })
    return finalize(
      'rejected',
      'entity_assets',
      threshold,
      { netWorth: i.totalAssetsCents },
      reasons,
      i.avgConfidence,
    )
  }

  if (i.totalAssetsCents >= threshold) {
    reasons.push({
      code: 'ENTITY_ASSETS_APPROVED',
      message: `${i.entityType} with $${(i.totalAssetsCents / 100).toLocaleString()} in total assets meets Rule 501(a)(7)/(9) threshold.`,
      severity: 'info',
    })
    return finalize(
      'approved',
      'entity_assets',
      threshold,
      { netWorth: i.totalAssetsCents },
      reasons,
      i.avgConfidence,
    )
  }

  reasons.push({
    code: 'ENTITY_ASSETS_BELOW',
    message: `Entity total assets ($${(i.totalAssetsCents / 100).toLocaleString()}) below the $5,000,000 threshold.`,
    severity: 'error',
  })
  return finalize(
    'rejected',
    'entity_assets',
    threshold,
    { netWorth: i.totalAssetsCents },
    reasons,
    i.avgConfidence,
  )
}

function evaluateIncome(i: IncomeInputs): VerificationResult {
  const threshold = incomeThresholdCents(i.filingStatus)
  const reasons: RuleReason[] = []
  const y1 = i.year1AgiCents
  const y2 = i.year2AgiCents
  const y3Est = i.year3PayStubAnnualizedCents ?? i.year3W2Cents

  const y1Ok = y1 != null && y1 >= threshold
  const y2Ok = y2 != null && y2 >= threshold
  const y3Provided = y3Est != null
  const y3Ok = y3Provided && y3Est! >= threshold

  if (y1 == null && y2 == null) {
    reasons.push({
      code: 'INCOME_NO_DATA',
      message: 'No prior-year income data detected. Upload Form 1040 for the last two tax years.',
      severity: 'error',
    })
    return finalize('rejected', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: y3Est, payStubConfirmed: y3Ok }, reasons, i.avgConfidence)
  }

  if (!y1Ok && !y2Ok) {
    reasons.push({
      code: 'INCOME_BOTH_BELOW',
      message: 'Neither prior year meets the income threshold.',
      severity: 'error',
    })
    return finalize('rejected', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: y3Est, payStubConfirmed: y3Ok }, reasons, i.avgConfidence)
  }

  if (y1Ok !== y2Ok) {
    reasons.push({
      code: 'INCOME_ONE_YEAR',
      message: 'Only one prior year meets the income threshold. SEC requires both — escalating for CPA judgment.',
      severity: 'warning',
    })
    return finalize('manual_review', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: y3Est, payStubConfirmed: y3Ok }, reasons, i.avgConfidence)
  }

  // Both prior years clear.
  if (y3Ok) {
    reasons.push({
      code: 'INCOME_APPROVED',
      message: 'Both prior years and current-year evidence meet the threshold.',
      severity: 'info',
    })
    return finalize('approved', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: y3Est, payStubConfirmed: true }, reasons, i.avgConfidence)
  }

  if (y3Provided && !y3Ok) {
    reasons.push({
      code: 'INCOME_CURRENT_BELOW',
      message: 'Current-year evidence (pay stub or W-2) projects below threshold. CPA review required.',
      severity: 'warning',
    })
    return finalize('manual_review', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: y3Est, payStubConfirmed: false }, reasons, i.avgConfidence)
  }

  // No current-year evidence at all. Historical behavior approved here;
  // SEC-review TODO #5 tracks tightening this.
  reasons.push({
    code: 'INCOME_NO_CURRENT_YEAR',
    message: 'Both prior years qualify. No current-year evidence submitted — please provide 2 recent pay stubs or a current-year W-2.',
    severity: 'warning',
  })
  return finalize('manual_review', 'income', threshold, { incomeY1: y1, incomeY2: y2, incomeY3Est: null, payStubConfirmed: false }, reasons, i.avgConfidence)
}

function evaluateNetWorth(i: NetWorthInputs): VerificationResult {
  const threshold = SEC_THRESHOLDS.NET_WORTH_CENTS
  const reasons: RuleReason[] = []
  const netWorth = i.assetsCents - i.liabilitiesCents - i.primaryResidenceExcessCents

  if (i.mortgageChanged60d) {
    reasons.push({
      code: 'NETWORTH_60D_MORTGAGE_CHANGE',
      message: 'Primary-residence mortgage changed in last 60 days. CPA must review per SEC anti-gaming rule.',
      severity: 'warning',
    })
  }

  if (netWorth >= threshold) {
    reasons.push({
      code: 'NETWORTH_APPROVED',
      message: 'Computed net worth (excluding primary residence) meets the $1M threshold.',
      severity: 'info',
    })
    return finalize(
      i.mortgageChanged60d ? 'manual_review' : 'approved',
      'net_worth',
      threshold,
      { netWorth },
      reasons,
      i.avgConfidence,
    )
  }

  reasons.push({
    code: 'NETWORTH_BELOW',
    message: 'Computed net worth is below the $1,000,000 threshold.',
    severity: 'error',
  })
  return finalize('rejected', 'net_worth', threshold, { netWorth }, reasons, i.avgConfidence)
}

function finalize(
  status: RuleStatus,
  path: VerificationPath,
  threshold: number,
  computed: VerificationResult['computed'],
  reasons: RuleReason[],
  avgConfidence: number | null,
): VerificationResult {
  // Confidence gate — approved results with weak OCR get escalated.
  if (
    status === 'approved' &&
    avgConfidence != null &&
    avgConfidence < CONFIDENCE_ESCALATION_THRESHOLD
  ) {
    reasons.push({
      code: 'LOW_CONFIDENCE_ESCALATION',
      message: `Extraction confidence ${(avgConfidence * 100).toFixed(0)}% < ${(CONFIDENCE_ESCALATION_THRESHOLD * 100).toFixed(0)}% — escalating to manual review.`,
      severity: 'warning',
    })
    return { status: 'manual_review', path, threshold, computed, reasons, avgConfidence }
  }
  return { status, path, threshold, computed, reasons, avgConfidence }
}
