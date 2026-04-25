import { describe, it, expect } from 'vitest'
import {
  evaluate,
  incomeThresholdCents,
  priorTwoYears,
  type IncomeInputs,
  type NetWorthInputs,
} from '../src/lib/sec-verify'

describe('incomeThresholdCents', () => {
  it('returns $200k for single', () => {
    expect(incomeThresholdCents('single')).toBe(20_000_000)
  })
  it('returns $300k for MFJ', () => {
    expect(incomeThresholdCents('mfj')).toBe(30_000_000)
  })
  it('returns $300k for spousal_equivalent', () => {
    expect(incomeThresholdCents('spousal_equivalent')).toBe(30_000_000)
  })
})

describe('priorTwoYears', () => {
  it('returns [Y-3, Y-2] before April', () => {
    expect(priorTwoYears(new Date('2026-02-15'))).toEqual([2023, 2024])
  })
  it('returns [Y-2, Y-1] on/after April', () => {
    expect(priorTwoYears(new Date('2026-04-15'))).toEqual([2024, 2025])
  })
})

const baseIncome = (over: Partial<IncomeInputs> = {}): IncomeInputs => ({
  path: 'income',
  filingStatus: 'mfj',
  year1AgiCents: 35_000_000,
  year2AgiCents: 36_000_000,
  year3PayStubAnnualizedCents: 37_000_000,
  year3W2Cents: null,
  avgConfidence: 0.92,
  ...over,
})

describe('income path', () => {
  it('approves when all three years clear threshold', () => {
    const r = evaluate(baseIncome())
    expect(r.status).toBe('approved')
    expect(r.computed.payStubConfirmed).toBe(true)
  })

  it('manual_review when both prior years pass but current-year missing', () => {
    const r = evaluate(baseIncome({ year3PayStubAnnualizedCents: null, year3W2Cents: null }))
    expect(r.status).toBe('manual_review')
    expect(r.reasons.some((x) => x.code === 'INCOME_NO_CURRENT_YEAR')).toBe(true)
  })

  it('manual_review when only one prior year clears', () => {
    const r = evaluate(baseIncome({ year1AgiCents: 25_000_000, year2AgiCents: 35_000_000 }))
    expect(r.status).toBe('manual_review')
    expect(r.reasons.some((x) => x.code === 'INCOME_ONE_YEAR')).toBe(true)
  })

  it('rejects when neither prior year meets threshold', () => {
    const r = evaluate(baseIncome({ year1AgiCents: 10_000_000, year2AgiCents: 12_000_000 }))
    expect(r.status).toBe('rejected')
  })

  it('rejects when no data at all', () => {
    const r = evaluate(baseIncome({ year1AgiCents: null, year2AgiCents: null }))
    expect(r.status).toBe('rejected')
  })

  it('manual_review when current year evidence below threshold', () => {
    const r = evaluate(baseIncome({ year3PayStubAnnualizedCents: 20_000_000 }))
    expect(r.status).toBe('manual_review')
    expect(r.reasons.some((x) => x.code === 'INCOME_CURRENT_BELOW')).toBe(true)
  })

  it('applies $200k threshold for single filer', () => {
    const r = evaluate(
      baseIncome({
        filingStatus: 'single',
        year1AgiCents: 22_000_000,
        year2AgiCents: 24_000_000,
        year3PayStubAnnualizedCents: 25_000_000,
      }),
    )
    expect(r.threshold).toBe(20_000_000)
    expect(r.status).toBe('approved')
  })

  it('escalates approved result to manual_review on low confidence', () => {
    const r = evaluate(baseIncome({ avgConfidence: 0.4 }))
    expect(r.status).toBe('manual_review')
    expect(r.reasons.some((x) => x.code === 'LOW_CONFIDENCE_ESCALATION')).toBe(true)
  })
})

const baseNW = (over: Partial<NetWorthInputs> = {}): NetWorthInputs => ({
  path: 'net_worth',
  assetsCents: 140_000_000,
  liabilitiesCents: 10_000_000,
  primaryResidenceExcessCents: 0,
  mortgageChanged60d: false,
  avgConfidence: 0.9,
  ...over,
})

describe('net_worth path', () => {
  it('approves at or above $1M', () => {
    const r = evaluate(baseNW())
    expect(r.status).toBe('approved')
    expect(r.computed.netWorth).toBe(130_000_000)
  })

  it('rejects below $1M', () => {
    const r = evaluate(baseNW({ assetsCents: 105_000_000, liabilitiesCents: 10_000_000 }))
    expect(r.status).toBe('rejected')
  })

  it('routes approved to manual_review if mortgage changed in 60 days', () => {
    const r = evaluate(baseNW({ mortgageChanged60d: true }))
    expect(r.status).toBe('manual_review')
    expect(r.reasons.some((x) => x.code === 'NETWORTH_60D_MORTGAGE_CHANGE')).toBe(true)
  })

  it('subtracts primary-residence excess mortgage', () => {
    const r = evaluate(
      baseNW({
        assetsCents: 150_000_000,
        liabilitiesCents: 0,
        primaryResidenceExcessCents: 60_000_000,
      }),
    )
    expect(r.computed.netWorth).toBe(90_000_000)
    expect(r.status).toBe('rejected')
  })

  it('escalates approved result to manual_review on low confidence', () => {
    const r = evaluate(baseNW({ avgConfidence: 0.3 }))
    expect(r.status).toBe('manual_review')
  })
})
