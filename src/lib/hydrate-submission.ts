/**
 * Hydrates a submission row from its Form 1040 extractions so the letter
 * DOCX template gets real investor name, address, tax years, and filing
 * status — mirroring the reference Python orchestrator's "Form 1040 is the
 * source of truth for letter-facing data" pattern.
 *
 * We pick the highest-confidence completed 1040 for the name/address/filing
 * status, and use the two most recent tax years across 1040s for the primary
 * and secondary year fields. Existing non-empty submission values are
 * preserved — this is additive, never destructive.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { document, submission } from '@/db/schema'

type Form1040Raw = {
  investorName?: string | null
  taxpayerName?: string | null
  spouseName?: string | null
  investorAddressLine1?: string | null
  investorAddressLine2?: string | null
  addressRaw?: string | null
  taxYear?: number | null
  filingStatus?: string | null
  agiCents?: number | null
}

export async function hydrateSubmissionFromForm1040(
  submissionId: string,
): Promise<void> {
  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, submissionId))
    .limit(1)
  if (!sub) return

  const forms = await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.submissionId, submissionId),
        eq(document.type, 'form_1040'),
        eq(document.extractionStatus, 'done'),
      ),
    )
  if (forms.length === 0) return

  const ranked = forms
    .map((d) => ({
      d,
      raw: (d.rawExtraction ?? {}) as Form1040Raw,
      conf: toNumber(d.confidence) ?? 0,
    }))
    .filter((x) => x.raw && Object.keys(x.raw).length > 0)

  if (ranked.length === 0) return

  const bestForNames = [...ranked].sort((a, b) => b.conf - a.conf)[0]

  // Two most recent distinct tax years, across all 1040s.
  const years = Array.from(
    new Set(
      ranked
        .map((x) => x.raw.taxYear)
        .filter((y): y is number => typeof y === 'number' && y > 1900),
    ),
  ).sort((a, b) => b - a)

  const patch: Partial<typeof submission.$inferInsert> = {}

  const investorName = bestForNames.raw.investorName ?? bestForNames.raw.taxpayerName
  if (investorName && !isMeaningful(sub.investorName)) {
    patch.investorName = investorName
  }

  const line1 = bestForNames.raw.investorAddressLine1
  if (line1 && !isMeaningful(sub.investorAddressLine1)) {
    patch.investorAddressLine1 = line1
  }

  const line2 = bestForNames.raw.investorAddressLine2
  if (line2 && !isMeaningful(sub.investorAddressLine2)) {
    patch.investorAddressLine2 = line2
  }

  if (!sub.taxYearPrimary && years[0]) patch.taxYearPrimary = years[0]
  if (!sub.taxYearSecondary && years[1]) patch.taxYearSecondary = years[1]

  const filing = mapFilingStatus(bestForNames.raw.filingStatus)
  if (filing && !sub.filingStatus) patch.filingStatus = filing

  if (Object.keys(patch).length === 0) return

  patch.updatedAt = new Date()
  await db.update(submission).set(patch).where(eq(submission.id, submissionId))
}

function isMeaningful(v: string | null | undefined): boolean {
  if (!v) return false
  const t = v.trim()
  if (!t) return false
  if (t === '—' || t === '-') return false
  return true
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function mapFilingStatus(
  s: string | null | undefined,
): 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss' | 'spousal_equivalent' | null {
  if (!s) return null
  const l = s.toLowerCase()
  if (l === 'mfj' || l.includes('joint')) return 'mfj'
  if (l === 'mfs' || l.includes('separately')) return 'mfs'
  if (l === 'hoh' || l.includes('head')) return 'hoh'
  if (l === 'qss' || l.includes('surviv') || l.includes('qualifying')) return 'qss'
  if (l === 'single' || l.includes('single')) return 'single'
  return null
}
