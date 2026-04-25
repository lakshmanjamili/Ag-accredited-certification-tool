import Link from 'next/link'
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Award,
  Mail,
} from 'lucide-react'
import type { AggregatedInputs } from '@/lib/aggregate-extraction'
import { evaluate, type VerificationResult } from '@/lib/sec-verify'
import { SEC_THRESHOLDS } from '@/lib/constants'
import { relativeTime, formatDateLong } from '@/lib/utils'

type Status =
  | 'draft'
  | 'pending_extraction'
  | 'pending_admin_review'
  | 'assigned'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'letter_generated'

export function SubmissionPackage({
  aggregated,
  path,
  filingStatus,
  status,
  submittedAt,
  attestedAt,
  cpaName,
}: {
  aggregated: AggregatedInputs
  path: 'income' | 'net_worth' | 'professional' | 'entity_assets' | null
  filingStatus: string | null
  status: Status
  submittedAt: Date | null
  attestedAt: Date | null
  cpaName: string | null
}) {
  // Live rule evaluation — same one the CPA sees
  const evaluation: VerificationResult | null =
    aggregated.inputs && aggregated.inputs.path === 'income' ? evaluate(aggregated.inputs) : null

  return (
    <div className="space-y-6">
      {/* Submission receipt */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[color-mix(in_oklab,var(--primary)_92%,white)] to-[var(--primary-container)] p-8 text-white shadow-ghost-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-secondary-container">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Submitted for CPA review
          </div>
          <h2 className="font-serif text-3xl italic sm:text-4xl">
            Here&apos;s what we sent to your CPA.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
            Your numbers are extracted and ready. A licensed CPA will verify every line
            before signing your certificate.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
            {submittedAt && (
              <Chip icon={<Clock className="h-3.5 w-3.5" />}>
                Submitted {relativeTime(submittedAt)}
              </Chip>
            )}
            {attestedAt && (
              <Chip icon={<CheckCircle2 className="h-3.5 w-3.5" />}>You attested</Chip>
            )}
            {cpaName ? (
              <Chip icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Assigned to {cpaName}
              </Chip>
            ) : (
              <Chip icon={<ShieldCheck className="h-3.5 w-3.5" />}>Awaiting CPA claim</Chip>
            )}
          </div>
        </div>
      </div>

      {/* Preliminary rule result — the CPA sees the same */}
      {aggregated.inputs && aggregated.inputs.path === 'income' && evaluation && (
        <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                Preliminary AI evaluation
              </div>
              <h3 className="font-serif text-xl font-semibold italic text-primary">
                {prelimLabel(evaluation.status)}
              </h3>
            </div>
            <ResultPill status={evaluation.status} />
          </div>
          <p className="text-sm text-on-surface-variant">
            {path === 'income' ? 'Income' : 'Net-worth'} path · {filingLabel(filingStatus)} ·
            Threshold ${(evaluation.threshold / 100).toLocaleString('en-US')}/yr
          </p>

          <div className="mt-5 space-y-2 rounded-2xl bg-surface-low p-4">
            <RuleLine
              year={aggregated.usedYears.y1}
              label={`${aggregated.usedYears.y1} · AGI from Form 1040`}
              valueCents={aggregated.inputs.year1AgiCents}
              threshold={evaluation.threshold}
            />
            <RuleLine
              year={aggregated.usedYears.y2}
              label={`${aggregated.usedYears.y2} · AGI from Form 1040`}
              valueCents={aggregated.inputs.year2AgiCents}
              threshold={evaluation.threshold}
            />
            <RuleLine
              year={aggregated.usedYears.current}
              label={`${aggregated.usedYears.current} · Current-year estimate`}
              valueCents={
                aggregated.inputs.year3PayStubAnnualizedCents ??
                aggregated.inputs.year3W2Cents
              }
              threshold={evaluation.threshold}
            />
          </div>

          {evaluation.reasons.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-xs">
              {evaluation.reasons.map((r, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg p-2 ${
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
          <p className="mt-4 text-xs text-on-surface-variant/80">
            This is the AI&apos;s first pass. Your CPA reviews every number against the
            original document before making the final decision.
          </p>
        </div>
      )}

      {/* What was extracted per doc */}
      {aggregated.summaries.length > 0 && (
        <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
          <h3 className="font-serif text-xl font-semibold text-primary">
            What we extracted from your documents
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Azure Document Intelligence read each file. Confirm the numbers look right.
          </p>
          <div className="mt-5 space-y-3">
            {aggregated.summaries.map((s) => {
              const highlighted = s.fields.filter((f) => f.highlight)
              const preview = highlighted.length > 0 ? highlighted : s.fields.slice(0, 3)
              return (
                <div
                  key={s.documentId}
                  className="flex items-start gap-4 rounded-2xl bg-surface-low p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <FileText className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="truncate font-semibold text-on-surface">
                        {s.fileName}
                      </h4>
                      {s.confidence != null && (
                        <span
                          className={`font-mono text-[10px] font-bold uppercase ${
                            s.confidence >= 0.8
                              ? 'text-[var(--success)]'
                              : s.confidence >= 0.6
                              ? 'text-secondary'
                              : 'text-destructive'
                          }`}
                        >
                          {(s.confidence * 100).toFixed(0)}% confidence
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {s.type.replace('_', ' ')} · {s.extractionStatus}
                    </div>
                    {preview.length > 0 && (
                      <dl className="mt-3 space-y-1">
                        {preview.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <dt className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                              {f.label}
                            </dt>
                            <dd
                              className={`font-mono text-sm tabular-nums ${
                                f.highlight
                                  ? 'font-bold text-primary'
                                  : 'text-on-surface'
                              }`}
                            >
                              {f.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* What happens next timeline */}
      <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
        <h3 className="font-serif text-xl font-semibold text-primary">
          What happens next
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Four quick steps. We&apos;ll update you at every handoff.
        </p>
        <ol className="mt-5 space-y-3">
          <TimelineItem
            done={true}
            icon={<Sparkles className="h-4 w-4" />}
            title="AI extraction complete"
            body="Azure Document Intelligence read each file. Preliminary rule check above."
          />
          <TimelineItem
            done={status !== 'pending_admin_review'}
            active={status === 'pending_admin_review'}
            icon={<ShieldCheck className="h-4 w-4" />}
            title="CPA review"
            body={
              status === 'pending_admin_review'
                ? 'You are in the queue — a CPA will claim your submission and review it. Typical turnaround is under 24 hours.'
                : status === 'assigned' || status === 'in_review'
                ? `${cpaName ?? 'A CPA'} has claimed your submission and is reviewing right now.`
                : 'A CPA has already reviewed this submission.'
            }
          />
          <TimelineItem
            done={status === 'approved' || status === 'letter_generated'}
            active={status === 'approved'}
            icon={<Award className="h-4 w-4" />}
            title="Sign & issue certificate"
            body={
              status === 'approved'
                ? 'Your CPA is drawing their signature — your certificate will be ready any moment.'
                : status === 'letter_generated'
                ? 'Certificate ready. Open the Vault below to download.'
                : 'Your CPA draws their signature and we generate a branded PDF + DOCX.'
            }
          />
          <TimelineItem
            done={status === 'letter_generated'}
            active={false}
            icon={<Mail className="h-4 w-4" />}
            title="Share with issuers"
            body="Download the signed PDF. Share the public verify link — issuers can check authenticity instantly via QR."
            cta={status === 'letter_generated' ? { href: '/letter', label: 'Open Vault' } : undefined}
          />
        </ol>

        {submittedAt && (
          <p className="mt-5 text-xs text-on-surface-variant">
            Submitted on {formatDateLong(submittedAt)}. We&apos;ll never auto-approve.
            Every certificate is CPA-signed.
          </p>
        )}
      </div>
    </div>
  )
}

function Chip({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur">
      {icon}
      {children}
    </span>
  )
}

function ResultPill({ status }: { status: 'approved' | 'rejected' | 'manual_review' }) {
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--success)]">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Meets threshold
      </span>
    )
  if (status === 'rejected')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-destructive">
        <XCircle className="h-3 w-3" strokeWidth={2} />
        Below threshold
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
      <AlertTriangle className="h-3 w-3" strokeWidth={2} />
      Manual review
    </span>
  )
}

function prelimLabel(status: 'approved' | 'rejected' | 'manual_review'): string {
  if (status === 'approved') return 'Your numbers meet the SEC threshold.'
  if (status === 'rejected') return "Your numbers don't meet the threshold on this path."
  return 'CPA judgment required on one or more items.'
}

function filingLabel(s: string | null): string {
  switch (s) {
    case 'mfj':
      return 'Married filing jointly'
    case 'spousal_equivalent':
      return 'Spousal equivalent'
    case 'single':
      return 'Single'
    case 'mfs':
      return 'Married filing separately'
    case 'hoh':
      return 'Head of household'
    case 'qss':
      return 'Qualifying surviving spouse'
    default:
      return '—'
  }
}

function RuleLine({
  label,
  valueCents,
  threshold,
}: {
  year: number
  label: string
  valueCents: number | null
  threshold: number
}) {
  const ok = valueCents != null && valueCents >= threshold
  const icon =
    valueCents == null ? (
      <AlertTriangle className="h-4 w-4 text-on-surface-variant/60" strokeWidth={1.5} />
    ) : ok ? (
      <CheckCircle2 className="h-4 w-4 text-[var(--success)]" strokeWidth={1.8} />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" strokeWidth={1.8} />
    )
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-on-surface">{label}</span>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-semibold tabular-nums text-on-surface">
          {valueCents != null
            ? new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
              }).format(valueCents / 100)
            : '—'}
        </div>
        <div className="text-[10px] tracking-widest text-on-surface-variant">
          vs{' '}
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
          }).format(threshold / 100)}
        </div>
      </div>
    </div>
  )
}

function TimelineItem({
  done,
  active,
  icon,
  title,
  body,
  cta,
}: {
  done: boolean
  active?: boolean
  icon: React.ReactNode
  title: string
  body: string
  cta?: { href: string; label: string }
}) {
  return (
    <li className="flex items-start gap-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-[var(--success)]/15 text-[var(--success)]'
            : active
            ? 'bg-secondary/15 text-secondary ring-4 ring-secondary/10'
            : 'bg-surface-low text-on-surface-variant/40'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-on-surface">{title}</h4>
          {done && <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" strokeWidth={2} />}
          {active && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              Now
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-on-surface-variant">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-2 inline-block text-sm font-semibold text-secondary hover:underline"
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </li>
  )
}
