import { Sparkles, ShieldCheck, FileCheck, Send, Award } from 'lucide-react'

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

const STEPS = [
  { id: 'docs', label: 'Upload', icon: FileCheck },
  { id: 'extract', label: 'AI extraction', icon: Sparkles },
  { id: 'submit', label: 'Submit', icon: Send },
  { id: 'cpa', label: 'CPA review', icon: ShieldCheck },
  { id: 'done', label: 'Certificate', icon: Award },
] as const

type StepId = (typeof STEPS)[number]['id']

function stepState(status: Status, step: StepId): 'done' | 'active' | 'pending' {
  const map: Record<Status, StepId> = {
    draft: 'docs',
    pending_extraction: 'extract',
    pending_admin_review: 'cpa',
    assigned: 'cpa',
    in_review: 'cpa',
    changes_requested: 'docs',
    approved: 'done',
    rejected: 'done',
    letter_generated: 'done',
  }
  const current = map[status]
  const order: StepId[] = ['docs', 'extract', 'submit', 'cpa', 'done']
  const iCur = order.indexOf(current)
  const iStep = order.indexOf(step)
  if (iStep < iCur) return 'done'
  if (iStep === iCur) return 'active'
  return 'pending'
}

export function SubmissionHero({
  name,
  pathLabel,
  thresholdLabel,
  status,
  readyCount,
  totalCount,
  docCount,
}: {
  name: string | null
  pathLabel: string
  thresholdLabel: string
  status: Status
  readyCount: number
  totalCount: number
  docCount: number
}) {
  const subtitle = headline(status, { readyCount, totalCount, docCount })

  return (
    <section className="overflow-hidden rounded-3xl bg-navy-gradient text-white shadow-ghost-lg">
      <div className="relative px-8 py-10 sm:px-12 sm:py-14">
        {/* Decorative sheen */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-6 top-6 opacity-10">
          <ShieldCheck className="h-32 w-32" strokeWidth={1} />
        </div>

        <div className="relative">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            SEC Rule 501(a) verification
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">
            {greeting(name)}
            <span className="italic text-secondary"> {subtitle.accent}</span>
            {subtitle.tail}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            {subtitle.body}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur">
              {pathLabel}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur">
              {thresholdLabel}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur">
              {docCount} doc{docCount === 1 ? '' : 's'} uploaded
            </span>
          </div>
        </div>
      </div>

      {/* Step rail */}
      <div className="border-t border-white/10 bg-black/20 px-4 py-5 sm:px-12">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {STEPS.map((s, i) => {
            const state = stepState(status, s.id)
            const Icon = s.icon
            return (
              <div key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    state === 'done'
                      ? 'bg-secondary text-white'
                      : state === 'active'
                      ? 'bg-white text-primary ring-4 ring-white/20'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[11px] font-bold uppercase tracking-widest ${
                      state === 'pending' ? 'text-white/40' : 'text-white'
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${
                      state === 'done' ? 'bg-secondary/50' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function greeting(name: string | null): string {
  if (!name) return 'Welcome,'
  const first = name.split(/\s+/)[0]
  return `Welcome, ${first}.`
}

function headline(
  status: Status,
  ctx: { readyCount: number; totalCount: number; docCount: number },
): { accent: string; tail: string; body: string } {
  switch (status) {
    case 'draft':
      if (ctx.docCount === 0) {
        return {
          accent: "let's gather",
          tail: ' what the SEC needs.',
          body:
            "We'll walk you through exactly which documents to upload. Our AI reads each one; your CPA signs off on the numbers.",
        }
      }
      if (ctx.readyCount < ctx.totalCount) {
        return {
          accent: `${ctx.readyCount} of ${ctx.totalCount}`,
          tail: ' documents ready.',
          body:
            "Keep dropping files on the left. As each one is scanned, we'll check it off on the right.",
        }
      }
      return {
        accent: "you're ready",
        tail: ' to submit.',
        body:
          "Everything the checklist needs is in. Attest and submit for CPA review whenever you're ready.",
      }
    case 'pending_extraction':
      return {
        accent: 'our AI is reading',
        tail: ' your documents.',
        body:
          "Azure Document Intelligence is scanning each upload. This usually takes under a minute — refresh to see progress.",
      }
    case 'pending_admin_review':
      return {
        accent: 'a CPA will review',
        tail: ' your submission shortly.',
        body:
          "You're in the queue. A licensed CPA will verify every document and either approve, request changes, or reject. Typical turnaround is under 24 hours.",
      }
    case 'assigned':
    case 'in_review':
      return {
        accent: 'your CPA is reviewing',
        tail: ' right now.',
        body:
          "A CPA has claimed your submission and is actively reviewing the documents.",
      }
    case 'changes_requested':
      return {
        accent: 'a small update',
        tail: ' is needed.',
        body:
          "Your CPA has asked for more or clearer documents. Check the note below, re-upload the missing items, and resubmit.",
      }
    case 'approved':
      return {
        accent: 'approved',
        tail: ' — certificate incoming.',
        body:
          "Your CPA has approved your accredited status. They'll sign and generate the certificate shortly.",
      }
    case 'letter_generated':
      return {
        accent: 'your certificate is ready.',
        tail: '',
        body:
          "Open the Vault to download your signed verification letter. You can share the public verify link with any issuer.",
      }
    case 'rejected':
      return {
        accent: 'not granted',
        tail: ' this time.',
        body:
          "The CPA could not verify accredited status from the evidence provided. You can start a new verification anytime from the dashboard.",
      }
  }
}
