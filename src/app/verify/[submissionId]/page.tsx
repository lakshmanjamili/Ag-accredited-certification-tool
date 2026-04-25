import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { AppHeader } from '@/components/shared/app-header'
import { db } from '@/db/client'
import { submission, document, reviewDecision, userProfile } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/utils'
import { StructuredUploader } from '@/components/customer/structured-uploader'
import { SubmitPanel } from '@/components/customer/submit-panel'
import { PreSubmitSummary } from '@/components/customer/pre-submit-summary'
import { VerifyChecklist } from '@/components/customer/verify-checklist'
import { ChangesBanner } from '@/components/customer/changes-banner'
import { SubmissionHero } from '@/components/customer/submission-hero'
import { SubmissionPackage } from '@/components/customer/submission-package'
import { AutoRefresh } from '@/components/customer/auto-refresh'
import { computePlan } from '@/lib/verify-requirements'
import { aggregateForReview } from '@/lib/aggregate-extraction'

type Params = Promise<{ submissionId: string }>

const EDITABLE: ReadonlyArray<string> = ['draft', 'changes_requested']

export default async function SubmissionPage({ params }: { params: Params }) {
  const user = await requireUser()
  const { submissionId } = await params

  const [row] = await db.select().from(submission).where(eq(submission.id, submissionId)).limit(1)
  if (!row || row.customerId !== user.id) notFound()

  const docs = await db
    .select()
    .from(document)
    .where(eq(document.submissionId, submissionId))
    .orderBy(desc(document.uploadedAt))

  const plan = computePlan(row, docs)
  const aggregated = aggregateForReview(row, docs)
  const canEdit = EDITABLE.includes(row.status)
  const hasBeenSubmitted = !!row.submittedAt

  // Poll server while extraction is in flight so OCR results appear without manual refresh
  const hasPendingExtraction = docs.some(
    (d) => d.extractionStatus === 'pending' || d.extractionStatus === 'in_progress',
  )
  const isAwaitingStatusChange =
    row.status === 'pending_admin_review' ||
    row.status === 'assigned' ||
    row.status === 'in_review' ||
    row.status === 'approved' // waiting for letter generation

  const [latestDecision] = await db
    .select({
      notes: reviewDecision.notes,
      createdAt: reviewDecision.createdAt,
      cpaName: userProfile.fullName,
    })
    .from(reviewDecision)
    .leftJoin(userProfile, eq(userProfile.id, reviewDecision.adminId))
    .where(eq(reviewDecision.submissionId, submissionId))
    .orderBy(desc(reviewDecision.createdAt))
    .limit(1)

  let assignedCpaName: string | null = null
  if (row.assignedAdminId) {
    const [assignee] = await db
      .select({ name: userProfile.fullName })
      .from(userProfile)
      .where(eq(userProfile.id, row.assignedAdminId))
      .limit(1)
    assignedCpaName = assignee?.name ?? null
  }

  const pathLabel = row.verificationPath
    ? `${row.verificationPath.replace('_', ' ')} path`
    : 'Verification'
  const thresholdLabel =
    row.filingStatus === 'mfj' || row.filingStatus === 'spousal_equivalent'
      ? '$300,000/year threshold'
      : row.verificationPath === 'net_worth'
      ? '$1M net worth threshold'
      : '$200,000/year threshold'

  return (
    <>
      <AppHeader userId={user.id} userLabel={user.email} role="customer" />
      <AutoRefresh active={hasPendingExtraction || isAwaitingStatusChange} />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <SubmissionHero
          name={row.investorName ?? user.fullName}
          pathLabel={pathLabel}
          thresholdLabel={thresholdLabel}
          status={row.status}
          readyCount={plan.completion.filled}
          totalCount={plan.completion.total}
          docCount={docs.length}
        />

        {row.status === 'changes_requested' && latestDecision && (
          <ChangesBanner
            note={latestDecision.notes}
            requestedAt={latestDecision.createdAt}
            cpaName={latestDecision.cpaName}
          />
        )}

        {hasBeenSubmitted && !canEdit && (
          <SubmissionPackage
            aggregated={aggregated}
            path={row.verificationPath}
            filingStatus={row.filingStatus}
            status={row.status}
            submittedAt={row.submittedAt}
            attestedAt={row.customerAttestedAt}
            cpaName={assignedCpaName}
          />
        )}

        {canEdit && (
          <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Upload documents
                  </h2>
                  <span className="text-xs text-on-surface-variant">
                    {docs.length} uploaded · Started {relativeTime(row.createdAt)}
                  </span>
                </div>
                <p className="mb-6 text-sm text-on-surface-variant">
                  Each slot is labeled with the exact document we need. We&apos;ll read
                  it, show you the extracted values, and flag mismatches before your CPA
                  sees anything.
                </p>
                <StructuredUploader
                  submissionId={submissionId}
                  verificationPath={row.verificationPath}
                  filingStatus={row.filingStatus}
                  docs={docs}
                />
              </div>

              {docs.length > 0 && <PreSubmitSummary aggregated={aggregated} />}
            </div>

            <div className="space-y-6">
              <VerifyChecklist plan={plan} />
              <SubmitPanel
                submissionId={submissionId}
                status={row.status}
                ready={plan.ready}
                completion={plan.completion}
              />
            </div>
          </div>
        )}
      </main>
    </>
  )
}

function ExtractionBadge({ status }: { status: string }) {
  if (status === 'done') return <Badge variant="success">Extracted</Badge>
  if (status === 'in_progress') return <Badge variant="outline">Reading…</Badge>
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="outline">Queued</Badge>
}
