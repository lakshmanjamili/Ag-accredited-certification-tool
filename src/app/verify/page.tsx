import { and, desc, eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { ShieldCheck, Sparkles, FileCheck } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { db } from '@/db/client'
import { submission } from '@/db/schema'
import { AppHeader } from '@/components/shared/app-header'
import { VerifyPicker } from './verify-picker'

type FilingStatus =
  | 'single'
  | 'mfs'
  | 'hoh'
  | 'qss'
  | 'mfj'
  | 'spousal_equivalent'

type PathId = 'income' | 'net_worth' | 'professional'

export default async function VerifyPage() {
  const user = await requireUser()

  const drafts = await db
    .select()
    .from(submission)
    .where(
      and(
        eq(submission.customerId, user.id),
        inArray(submission.status, ['draft', 'changes_requested']),
      ),
    )
    .orderBy(desc(submission.updatedAt))
    .limit(1)

  const draft = drafts[0]

  return (
    <>
      <AppHeader userId={user.id} userLabel={user.email} role="customer" />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-12 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-secondary">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            SEC Rule 501(a) verification
          </div>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-primary sm:text-5xl">
            Choose the path that fits your <span className="italic text-secondary">situation.</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            The SEC defines three ways an individual qualifies as an accredited investor.
            You only need to satisfy one of them. Pick the one where you have the
            cleanest paper trail — your CPA will review everything and sign.
          </p>
        </div>

        <div className="mb-10 grid gap-3 sm:grid-cols-3">
          <InfoStrip
            n="01"
            icon={<FileCheck className="h-4 w-4" strokeWidth={1.8} />}
            title="You choose the path"
            body="Each path has different documents. We show exactly what to upload."
          />
          <InfoStrip
            n="02"
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
            title="AI extracts the numbers"
            body="Azure Document Intelligence reads each document and pulls out the key values."
          />
          <InfoStrip
            n="03"
            icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.8} />}
            title="CPA reviews and signs"
            body="A licensed CPA confirms the math, signs, and issues your certificate."
          />
        </div>

        <VerifyPicker
          initialPath={(draft?.verificationPath as PathId | null) ?? null}
          initialFiling={(draft?.filingStatus as FilingStatus | null) ?? null}
          hasDraft={!!draft}
        />

        <p className="mt-10 text-center text-xs text-on-surface-variant">
          Already started?{' '}
          <Link href="/dashboard" className="font-semibold text-primary hover:underline">
            See your verifications
          </Link>
        </p>
      </main>
    </>
  )
}

function InfoStrip({
  n,
  icon,
  title,
  body,
}: {
  n: string
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-xl bg-surface-low p-4">
      <div className="flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary">
          {icon}
        </div>
        <span className="font-mono text-[11px] tracking-widest text-on-surface-variant/60">
          {n}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-on-surface">{title}</h3>
      <p className="mt-1 text-xs leading-snug text-on-surface-variant">{body}</p>
    </div>
  )
}
