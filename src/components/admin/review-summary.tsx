import { CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { evaluate, type IncomeInputs, type VerificationResult } from '@/lib/sec-verify'
import { SEC_THRESHOLDS } from '@/lib/constants'
import type { AggregatedInputs } from '@/lib/aggregate-extraction'

type Props = {
  aggregated: AggregatedInputs
  filingLabel: string | null
  path: 'income' | 'net_worth' | 'professional' | 'entity_assets' | null
}

export function ReviewSummary({ aggregated, filingLabel, path }: Props) {
  const { inputs, usedYears } = aggregated

  // Run the rule engine live — CPA sees what the algorithm thinks.
  const evaluation: VerificationResult | null =
    inputs && inputs.path === 'income' ? evaluate(inputs) : null

  return (
    <div className="space-y-4 rounded-2xl bg-surface-lowest p-6 shadow-ghost">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">
          Auto-extracted preliminary result
        </div>
        <h3 className="mt-1 font-serif text-xl italic text-primary">
          {evaluation ? (
            <PrelimChip status={evaluation.status} />
          ) : path === 'net_worth' ? (
            <span>Net-worth path · CPA-reviewed</span>
          ) : (
            <span>Awaiting extractions</span>
          )}
        </h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Path: <span className="capitalize">{path?.replace('_', ' ') ?? '—'}</span>
          {filingLabel ? ` · ${filingLabel}` : ''}
          {evaluation
            ? ` · Threshold ${formatCurrency(evaluation.threshold)}`
            : ''}
        </p>
      </div>

      {inputs && inputs.path === 'income' && (
        <div className="space-y-2 rounded-xl bg-surface-low p-4">
          <RuleRow
            label={`Year ${usedYears.y1}`}
            year={usedYears.y1}
            valueCents={inputs.year1AgiCents}
            threshold={thresholdFor(inputs)}
            source="Form 1040 AGI"
          />
          <RuleRow
            label={`Year ${usedYears.y2}`}
            year={usedYears.y2}
            valueCents={inputs.year2AgiCents}
            threshold={thresholdFor(inputs)}
            source="Form 1040 AGI"
          />
          <RuleRow
            label={`Year ${usedYears.current} · est`}
            year={usedYears.current}
            valueCents={inputs.year3PayStubAnnualizedCents ?? inputs.year3W2Cents}
            threshold={thresholdFor(inputs)}
            source={
              inputs.year3PayStubAnnualizedCents != null
                ? 'Pay stub annualized'
                : inputs.year3W2Cents != null
                ? 'Current-year W-2'
                : '—'
            }
          />
          {inputs.avgConfidence != null && (
            <div className="flex items-center justify-between pt-2 text-xs text-on-surface-variant">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
                Avg OCR confidence
              </div>
              <div
                className={
                  inputs.avgConfidence >= 0.8
                    ? 'font-semibold text-[var(--success)]'
                    : inputs.avgConfidence >= 0.6
                    ? 'font-semibold text-secondary'
                    : 'font-semibold text-destructive'
                }
              >
                {(inputs.avgConfidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}

      {evaluation && evaluation.reasons.length > 0 && (
        <ul className="space-y-2 text-xs">
          {evaluation.reasons.map((r, i) => (
            <li
              key={i}
              className={`flex gap-2 rounded-lg p-2 ${
                r.severity === 'error'
                  ? 'bg-destructive/5 text-destructive'
                  : r.severity === 'warning'
                  ? 'bg-secondary/10 text-on-surface'
                  : 'bg-surface-low text-on-surface-variant'
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {r.severity === 'error' ? (
                  <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : r.severity === 'warning' ? (
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                )}
              </span>
              <span>{r.message}</span>
            </li>
          ))}
        </ul>
      )}

      {!inputs && path === 'income' && (
        <p className="rounded-lg bg-surface-low p-3 text-xs text-on-surface-variant">
          Waiting for Azure Document Intelligence to finish extracting the uploaded documents.
          Refresh in a few seconds.
        </p>
      )}
    </div>
  )
}

function PrelimChip({ status }: { status: 'approved' | 'rejected' | 'manual_review' }) {
  if (status === 'approved') return <span>Meets threshold · CPA approval ready</span>
  if (status === 'rejected') return <span>Does not meet threshold</span>
  return <span>Manual review required</span>
}

function RuleRow({
  label,
  valueCents,
  threshold,
  source,
}: {
  label: string
  year: number
  valueCents: number | null
  threshold: number
  source: string
}) {
  const ok = valueCents != null && valueCents >= threshold
  const icon = ok ? (
    <CheckCircle2 className="h-4 w-4 text-[var(--success)]" strokeWidth={1.8} />
  ) : valueCents == null ? (
    <AlertTriangle className="h-4 w-4 text-on-surface-variant/60" strokeWidth={1.5} />
  ) : (
    <XCircle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
  )

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <div className="min-w-0">
          <div className="font-medium text-on-surface">{label}</div>
          <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
            {source}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-on-surface">
          {valueCents != null ? formatCurrency(valueCents) : '—'}
        </div>
        {valueCents != null && (
          <div className="text-[10px] tracking-wider text-on-surface-variant">
            vs {formatCurrency(threshold)}
          </div>
        )}
      </div>
    </div>
  )
}

function thresholdFor(inputs: IncomeInputs) {
  return inputs.filingStatus === 'mfj' || inputs.filingStatus === 'spousal_equivalent'
    ? SEC_THRESHOLDS.JOINT_INCOME_CENTS
    : SEC_THRESHOLDS.INDIVIDUAL_INCOME_CENTS
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

// Unused import guard
void Badge
