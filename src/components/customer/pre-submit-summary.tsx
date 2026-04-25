/**
 * Pre-submit extraction summary — the last thing the customer sees before
 * hitting "Submit for CPA review". It surfaces the key numbers Azure DI
 * pulled out of each Form 1040 / W-2 / paystub / statement so the investor
 * can catch mis-reads *before* the CPA sees anything.
 *
 * Grouped by document with confidence chips; low-confidence lines are
 * highlighted in amber so the customer knows to double-check.
 */

import { CheckCircle2, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import type { AggregatedInputs, ExtractedSummary } from '@/lib/aggregate-extraction'
import { cn } from '@/lib/utils'

export function PreSubmitSummary({
  aggregated,
}: {
  aggregated: AggregatedInputs
}) {
  const summaries = aggregated.summaries
  const done = summaries.filter((s) => s.extractionStatus === 'done')
  const pending = summaries.filter(
    (s) => s.extractionStatus !== 'done' && s.extractionStatus !== 'failed',
  )
  const failed = summaries.filter((s) => s.extractionStatus === 'failed')

  if (summaries.length === 0) return null

  return (
    <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold text-primary">
          What we read from your documents
        </h3>
        <span className="text-xs text-on-surface-variant">
          {done.length}/{summaries.length} processed
        </span>
      </div>
      <p className="mb-4 text-sm text-on-surface-variant">
        Azure Document Intelligence pulled these values from your uploads. If
        anything looks wrong, fix the file and re-upload before submitting.
      </p>

      {pending.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface-low px-3 py-2 text-xs text-on-surface-variant">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {pending.length} document{pending.length === 1 ? '' : 's'} still
          processing — we&apos;ll refresh this pane automatically.
        </div>
      )}

      <div className="space-y-3">
        {done.map((s) => (
          <DocRow key={s.documentId} summary={s} />
        ))}
        {failed.map((s) => (
          <FailedRow key={s.documentId} summary={s} />
        ))}
      </div>
    </div>
  )
}

function DocRow({ summary }: { summary: ExtractedSummary }) {
  const highlights = summary.fields.filter((f) => f.highlight)
  const display = highlights.length > 0 ? highlights : summary.fields.slice(0, 4)

  return (
    <div className="rounded-xl border border-slate-200 bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText
            className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
            strokeWidth={1.8}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">
              {summary.fileName}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              {summary.type.replace('_', ' ')}
              {summary.taxYear ? ` · ${summary.taxYear}` : ''}
            </div>
          </div>
        </div>
        <ConfidenceChip value={summary.confidence} />
      </div>

      {display.length > 0 ? (
        <dl className="mt-3 divide-y divide-slate-100">
          {display.map((f, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 py-1.5"
            >
              <dt
                className={cn(
                  'text-[11px] uppercase tracking-wider',
                  f.highlight ? 'font-bold text-[#8E6F10]' : 'text-slate-500',
                )}
              >
                {f.label}
              </dt>
              <dd
                className={cn(
                  'font-mono text-[12.5px] tabular-nums',
                  f.highlight ? 'font-bold text-ink' : 'text-slate-800',
                )}
              >
                {f.value}
                {f.confidence != null && (
                  <span
                    className={cn(
                      'ml-2 text-[9.5px] font-bold',
                      f.confidence >= 0.8
                        ? 'text-[var(--success)]'
                        : f.confidence >= 0.6
                          ? 'text-secondary'
                          : 'text-destructive',
                    )}
                  >
                    {(f.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-on-surface-variant">
          Extraction returned no structured fields. Your CPA will still see the
          raw document — but please double-check it was uploaded correctly.
        </p>
      )}
    </div>
  )
}

function FailedRow({ summary }: { summary: ExtractedSummary }) {
  return (
    <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger-50)] p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]"
          strokeWidth={1.8}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {summary.fileName}
          </div>
          <div className="mt-0.5 text-xs text-[var(--danger)]">
            Extraction failed. Remove and re-upload, or submit anyway and let
            your CPA work from the raw file.
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfidenceChip({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        Reading
      </span>
    )
  }
  const pct = (value * 100).toFixed(0)
  const good = value >= 0.8
  const mid = value >= 0.6
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        good
          ? 'bg-[var(--success-50)] text-[var(--success)]'
          : mid
            ? 'bg-[var(--warn-50)] text-[var(--warn)]'
            : 'bg-[var(--danger-50)] text-[var(--danger)]',
      )}
    >
      <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
      {pct}% confidence
    </span>
  )
}
