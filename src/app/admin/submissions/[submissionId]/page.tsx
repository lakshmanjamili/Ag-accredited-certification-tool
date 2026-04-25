import Link from 'next/link'
import { eq, desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, User } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import {
  submission,
  document,
  userProfile,
  reviewDecision,
  adminProfile,
  certificate,
} from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateShort, relativeTime } from '@/lib/utils'
import { DecisionPanel } from '@/components/admin/decision-panel'
import { SignAndGeneratePanel } from '@/components/admin/signature-pad'
import { ReviewSummary } from '@/components/admin/review-summary'
import { type InspectorDoc } from '@/components/admin/document-inspector'
import { SplitReview } from '@/components/admin/split-review'
import { aggregateForReview } from '@/lib/aggregate-extraction'
import { hydrateSubmissionFromForm1040 } from '@/lib/hydrate-submission'
import { signStoragePaths } from '@/lib/signed-urls'
import { RevokeCertificateButton } from '@/components/admin/revoke-button'
import { QuickApprovePanel } from '@/components/admin/quick-approve'
import { createServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ submissionId: string }>

export default async function AdminSubmissionPage({ params }: { params: Params }) {
  const admin = await requireAdmin()
  const { submissionId } = await params

  // Fill letter-facing fields from the Form 1040 extraction if they're still
  // blank (e.g. first time a CPA opens a freshly-extracted submission).
  await hydrateSubmissionFromForm1040(submissionId).catch(() => {
    // Non-fatal — we still want to render the page.
  })

  const [sub] = await db.select().from(submission).where(eq(submission.id, submissionId)).limit(1)
  if (!sub) notFound()

  const [customer] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.id, sub.customerId))
    .limit(1)

  const docs = await db
    .select()
    .from(document)
    .where(eq(document.submissionId, submissionId))
    .orderBy(desc(document.uploadedAt))

  const decisions = await db
    .select({
      id: reviewDecision.id,
      decision: reviewDecision.decision,
      notes: reviewDecision.notes,
      createdAt: reviewDecision.createdAt,
      adminName: userProfile.fullName,
    })
    .from(reviewDecision)
    .leftJoin(userProfile, eq(userProfile.id, reviewDecision.adminId))
    .where(eq(reviewDecision.submissionId, submissionId))
    .orderBy(desc(reviewDecision.createdAt))

  const [profile] = await db
    .select()
    .from(adminProfile)
    .where(eq(adminProfile.userId, admin.id))
    .limit(1)

  const [cert] = await db
    .select()
    .from(certificate)
    .where(eq(certificate.submissionId, submissionId))
    .orderBy(desc(certificate.issuedAt))
    .limit(1)

  // Aggregate Azure extraction results into rule-engine inputs + per-doc summaries
  const aggregated = aggregateForReview(sub, docs)

  // If the admin has a saved profile signature, load a preview for the quick-approve panel
  let storedSignaturePreview: string | null = null
  if (profile?.signatureImagePath) {
    try {
      const supabase = createServiceClient()
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'
      const { data } = await supabase.storage
        .from(bucket)
        .download(profile.signatureImagePath)
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer())
        storedSignaturePreview = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch {
      // non-fatal
    }
  }

  // Short-lived signed URLs so the CPA can open each document inline
  const signed = await signStoragePaths(docs.map((d) => d.storagePath))

  const inspectorDocs: InspectorDoc[] = docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    type: d.type,
    uploadedAt: d.uploadedAt,
    signedUrl: signed[d.storagePath] ?? null,
    summary: aggregated.summaries.find((s) => s.documentId === d.id)!,
  }))

  const filingLabel = sub.filingStatus
    ? sub.filingStatus.toUpperCase() +
      (sub.filingStatus === 'mfj' || sub.filingStatus === 'spousal_equivalent'
        ? ' · $300k threshold'
        : ' · $200k threshold')
    : null

  const isAssignee = sub.assignedAdminId === admin.id
  const terminal = ['rejected', 'letter_generated'].includes(sub.status)

  return (
    <>
            <main className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/admin/queue"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back to queue
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-primary">
                {sub.investorName || customer?.fullName || customer?.email}
              </h1>
              <Badge variant="outline" className="capitalize">
                {sub.verificationPath?.replace('_', ' ') ?? '—'}
              </Badge>
              <Badge>{sub.status.replace('_', ' ')}</Badge>
            </div>
            <div className="mt-1 font-mono text-[11px] text-on-surface-variant">{submissionId}</div>
            <div className="mt-2 text-sm text-on-surface-variant">
              {customer?.email} · Filing {sub.filingStatus?.toUpperCase() ?? '—'} · Submitted{' '}
              {sub.submittedAt ? relativeTime(sub.submittedAt) : '—'}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[2fr,1fr]">
          {/* LEFT — side-by-side PDF viewer + active-doc fields */}
          <div className="space-y-4">
            <div>
              <div className="smallcaps text-[11px] text-slate-500">
                Human in the loop
              </div>
              <h2 className="font-serif text-[22px] text-ink" style={{ fontWeight: 600 }}>
                Source documents
              </h2>
              <p className="text-[12.5px] text-slate-500">
                {docs.length} file{docs.length === 1 ? '' : 's'} · click a tab and the PDF + the
                extracted values on the right both update to match.
              </p>
            </div>

            <SplitReview docs={inspectorDocs} />

            {decisions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Back-and-forth history</CardTitle>
                  <CardDescription>
                    Every CPA decision and note exchanged on this submission.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {decisions.map((d) => (
                      <li key={d.id} className="rounded-lg bg-surface-low p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                d.decision === 'approve'
                                  ? 'success'
                                  : d.decision === 'reject'
                                  ? 'destructive'
                                  : 'warning'
                              }
                              className="capitalize"
                            >
                              {d.decision.replace('_', ' ')}
                            </Badge>
                            {d.adminName && (
                              <span className="text-xs text-on-surface-variant">
                                {d.adminName}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-on-surface-variant">
                            {relativeTime(d.createdAt)}
                          </span>
                        </div>
                        {d.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface">
                            {d.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT — rule evaluation + customer card + decision/sign */}
          <div className="space-y-4">
            <ReviewSummary
              aggregated={aggregated}
              filingLabel={filingLabel}
              path={sub.verificationPath}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-on-surface-variant" strokeWidth={1.5} />
                  <span className="font-medium">{customer?.fullName ?? '—'}</span>
                </div>
                <div className="text-on-surface-variant">{customer?.email}</div>
                {customer?.phone && (
                  <div className="text-on-surface-variant">{customer.phone}</div>
                )}
                {sub.customerAttestedAt && (
                  <div className="pt-1 text-xs text-[var(--success)]">
                    ✓ Attested {relativeTime(sub.customerAttestedAt)}
                  </div>
                )}
              </CardContent>
            </Card>

            {!isAssignee && sub.status === 'pending_admin_review' && (
              <Card>
                <CardContent className="pt-6">
                  <p className="mb-3 text-sm text-on-surface-variant">
                    Claim this submission to record a decision.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/admin/queue?tab=available">Go to queue to claim</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* One-click approve & auto-sign — when CPA has a saved signature
                and the submission isn't approved / terminal yet */}
            {isAssignee &&
              !terminal &&
              sub.status !== 'approved' &&
              profile?.signatureImagePath && (
                <QuickApprovePanel
                  submissionId={submissionId}
                  cpaName={admin.fullName ?? admin.email}
                  signaturePreviewUrl={storedSignaturePreview}
                />
              )}

            {isAssignee && !terminal && sub.status !== 'approved' && (
              <DecisionPanel submissionId={submissionId} />
            )}

            {isAssignee && sub.status === 'approved' && !cert && (
              <SignAndGeneratePanel
                submissionId={submissionId}
                cpa={{
                  name: admin.fullName ?? admin.email,
                  title: profile?.title ?? 'CPA',
                  license: profile?.cpaLicenseNo ?? '',
                  firm: profile?.firmName ?? '',
                  jurisdiction: profile?.jurisdiction ?? '',
                  email: admin.email,
                }}
              />
            )}

            {cert && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Certificate issued</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="font-mono text-xs">{cert.certificateNumber}</div>
                  <div className="text-on-surface-variant">
                    Issued {formatDateShort(cert.issuedAt)} · valid through{' '}
                    {formatDateShort(cert.validThrough)}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/api/certificates/${cert.id}/download`}>Download PDF</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
