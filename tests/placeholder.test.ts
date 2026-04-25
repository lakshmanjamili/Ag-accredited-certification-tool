import { describe, expect, it } from 'vitest'
import { SEC_THRESHOLDS } from '../src/lib/constants'

describe('SEC thresholds sanity', () => {
  it('individual income is $200,000 in cents', () => {
    expect(SEC_THRESHOLDS.INDIVIDUAL_INCOME_CENTS).toBe(20_000_000)
  })

  it('joint income is $300,000 in cents', () => {
    expect(SEC_THRESHOLDS.JOINT_INCOME_CENTS).toBe(30_000_000)
  })

  it('net worth is $1,000,000 in cents', () => {
    expect(SEC_THRESHOLDS.NET_WORTH_CENTS).toBe(100_000_000)
  })
})
