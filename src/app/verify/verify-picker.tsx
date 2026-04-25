'use client'

import { useState, useTransition } from 'react'
import {
  Briefcase,
  Wallet,
  Award,
  Clock,
  CheckCircle2,
  ArrowRight,
  FileText,
  Users,
  Building2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createSubmissionAction } from './actions'
import { toast } from 'sonner'

type PathId = 'income' | 'net_worth' | 'professional' | 'entity_assets'

type FilingStatus =
  | 'single'
  | 'mfs'
  | 'hoh'
  | 'qss'
  | 'mfj'
  | 'spousal_equivalent'

const PATHS = [
  {
    id: 'income' as const,
    icon: Briefcase,
    title: 'Income',
    rule: 'SEC Rule 501(a)(6)',
    threshold: '$200K individual · $300K joint',
    summary:
      'You earn above the SEC income threshold in each of the last two tax years, with the same income expected this year.',
    fit: 'Best for W-2 employees, self-employed with 2+ filed returns, or dual-income households.',
    needs: [
      { icon: FileText, label: 'Form 1040 for each of the last two tax years' },
      { icon: FileText, label: 'Two recent pay stubs OR a current-year W-2' },
    ],
    turnaround: 'Typically < 24 hours',
    available: true,
  },
  {
    id: 'net_worth' as const,
    icon: Wallet,
    title: 'Net worth',
    rule: 'SEC Rule 501(a)(5)',
    threshold: '$1,000,000 excluding primary residence',
    summary:
      'Your total assets minus total liabilities exceed $1M, not counting the value of the home you live in.',
    fit: 'Best for high-net-worth individuals with bank, brokerage, retirement, or business assets.',
    needs: [
      { icon: FileText, label: 'Recent bank, brokerage, and retirement statements' },
      { icon: FileText, label: 'Investment property valuations (if any)' },
      { icon: FileText, label: 'Mortgage and loan statements for liabilities' },
      { icon: Users, label: 'Primary-residence information (FMV + mortgage)' },
    ],
    turnaround: '24–48 hours · CPA reviews every line',
    available: true,
  },
  {
    id: 'professional' as const,
    icon: Award,
    title: 'Professional credential',
    rule: 'SEC Rule 501(a)(10)',
    threshold: 'Active Series 7, 65, or 82 license',
    summary:
      'You hold a qualifying FINRA license in good standing. No income or net-worth test required.',
    fit: 'Best for registered investment professionals, brokers, advisers, and PM certificate holders.',
    needs: [
      { icon: FileText, label: 'FINRA BrokerCheck PDF (within 30 days) or CRD snapshot' },
    ],
    turnaround: 'Under 24 hours',
    available: true,
  },
  {
    id: 'entity_assets' as const,
    icon: Building2,
    title: 'Entity assets',
    rule: 'SEC Rule 501(a)(3) / 501(a)(7)',
    threshold: '$5,000,000+ in total assets',
    summary:
      'Corporations, partnerships, LLCs, business trusts, and 501(c)(3) non-profits qualify when total assets exceed $5M.',
    fit: 'Best for funds, family offices, holding companies, and investment entities (not formed solely to invest).',
    needs: [
      { icon: FileText, label: 'Recent audited or internal financial statements' },
      { icon: FileText, label: 'Bank / brokerage statements showing asset totals' },
      { icon: FileText, label: 'Articles of incorporation or certificate of good standing' },
    ],
    turnaround: 'Under 48 hours',
    available: true,
  },
] as const

const FILING_STATUSES: { value: FilingStatus; label: string; threshold: string }[] = [
  { value: 'mfj', label: 'Married filing jointly', threshold: '$300,000' },
  { value: 'spousal_equivalent', label: 'Spousal equivalent (domestic partner)', threshold: '$300,000' },
  { value: 'single', label: 'Single', threshold: '$200,000' },
  { value: 'mfs', label: 'Married filing separately', threshold: '$200,000' },
  { value: 'hoh', label: 'Head of household', threshold: '$200,000' },
  { value: 'qss', label: 'Qualifying surviving spouse', threshold: '$200,000' },
]

export function VerifyPicker({
  initialPath,
  initialFiling,
  hasDraft,
}: {
  initialPath?: PathId | null
  initialFiling?: FilingStatus | null
  hasDraft: boolean
}) {
  const [path, setPath] = useState<PathId | null>(initialPath ?? null)
  const [filing, setFiling] = useState<FilingStatus>(initialFiling ?? 'mfj')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!path) {
      toast.error('Choose a path to continue')
      return
    }
    const fd = new FormData()
    fd.set('verificationPath', path)
    if (path === 'income') fd.set('filingStatus', filing)
    startTransition(async () => {
      try {
        await createSubmissionAction(fd)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* 4 Path cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PATHS.map((p) => (
          <PathCard
            key={p.id}
            path={p}
            selected={path === p.id}
            onSelect={() => p.available && setPath(p.id)}
          />
        ))}
      </div>

      {/* Conditional filing status */}
      {path === 'income' && (
        <div className="rounded-2xl bg-surface-lowest p-6 shadow-ghost animate-in fade-in slide-in-from-top-2">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-secondary" strokeWidth={1.8} />
            <h3 className="font-serif text-lg font-semibold text-primary">Filing status</h3>
          </div>
          <p className="mb-4 text-sm text-on-surface-variant">
            Your SEC income threshold depends on how you file. Joint filers use $300,000;
            single filers use $200,000.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FILING_STATUSES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiling(f.value)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3 text-left transition-all',
                  filing === f.value
                    ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20'
                    : 'border-transparent bg-surface-low hover:bg-surface-container',
                )}
              >
                <div>
                  <div className="font-semibold text-on-surface">{f.label}</div>
                  <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                    Threshold {f.threshold}
                  </div>
                </div>
                {filing === f.value && (
                  <CheckCircle2 className="h-5 w-5 text-secondary" strokeWidth={1.8} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-lowest p-6 shadow-ghost">
        <div>
          <div className="font-serif text-lg font-semibold text-primary">
            {path ? 'Ready when you are.' : 'Pick the path that fits.'}
          </div>
          <div className="text-sm text-on-surface-variant">
            {path
              ? hasDraft
                ? 'This will update your existing draft.'
                : "Next step: upload the documents you've gathered."
              : 'You can switch paths later if you change your mind.'}
          </div>
        </div>
        <Button
          onClick={submit}
          size="xl"
          disabled={!path || pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {hasDraft ? 'Continue submission' : 'Start submission'}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function PathCard({
  path,
  selected,
  onSelect,
}: {
  path: (typeof PATHS)[number]
  selected: boolean
  onSelect: () => void
}) {
  const Icon = path.icon
  const disabled = !path.available

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'group relative flex h-full flex-col rounded-2xl bg-surface-lowest p-6 text-left transition-all',
        selected
          ? 'shadow-ghost-lg ring-2 ring-secondary'
          : 'shadow-ghost hover:shadow-ghost-lg',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      {selected && (
        <div className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-white">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
        </div>
      )}

      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>

      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
        {path.rule}
      </div>
      <h3 className="font-serif text-2xl font-semibold italic text-primary">{path.title}</h3>
      <div className="mt-1 text-sm font-semibold text-on-surface">{path.threshold}</div>

      <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{path.summary}</p>

      {selected && (
        <div className="mt-5 animate-in fade-in space-y-4">
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              What we&apos;ll ask for
            </div>
            <ul className="space-y-1.5">
              {path.needs.map((n, i) => {
                const NeedIcon = n.icon
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-on-surface"
                  >
                    <NeedIcon
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary"
                      strokeWidth={1.8}
                    />
                    <span>{n.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-lg bg-surface-low p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <Clock className="h-3 w-3" strokeWidth={1.8} />
              Turnaround
            </div>
            <div className="text-xs text-on-surface">{path.turnaround}</div>
          </div>

          <div className="rounded-lg bg-surface-low p-3">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Best for
            </div>
            <div className="text-xs text-on-surface">{path.fit}</div>
          </div>
        </div>
      )}

      {!selected && (
        <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-secondary opacity-0 transition-opacity group-hover:opacity-100">
          {disabled ? 'MVP deferred' : 'Tap to see what you need'}
          {!disabled && <ArrowRight className="h-3 w-3" strokeWidth={1.8} />}
        </div>
      )}

      {disabled && !selected && (
        <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/60">
          MVP deferred
        </div>
      )}
    </button>
  )
}
