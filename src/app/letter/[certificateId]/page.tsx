import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, ExternalLink } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { AppHeader } from '@/components/shared/app-header'
import { db } from '@/db/client'
import { certificate, submission, userProfile, adminProfile } from '@/db/schema'
import { VerificationLetter } from '@/components/shared/verification-letter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateLong } from '@/lib/utils'
import { createServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ certificateId: string }>

const BASIS_LABEL: Record<string, string> = {
  income: 'Income Test — Rule 501(a)(6)',
  net_worth: 'Net-Worth Test — Rule 501(a)(5)',
  professional: 'Professional License — Rule 501(a)(10)',
  entity_assets: 'Entity Assets — Rule 501(a)(7) / (9)',
}

export default async function LetterPreviewPage({ params }: { params: Params }) {
  const user = await requireUser()
  const { certificateId } = await params

  const [row] = await db
    .select({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      path: certificate.path,
      issuedAt: certificate.issuedAt,
      validThrough: certificate.validThrough,
      revoked: certificate.revoked,
      signatureStoragePath: certificate.signatureStoragePath,
      submissionId: certificate.submissionId,
      // Investor
      investorName: submission.investorName,
      customerId: submission.customerId,
      filingStatus: submission.filingStatus,
      // CPA
      cpaName: userProfile.fullName,
      cpaLicense: adminProfile.cpaLicenseNo,
      cpaFirm: adminProfile.firmName,
      cpaFirmCity: adminProfile.firmCity,
      cpaEmail: adminProfile.firmEmail,
      cpaPhone: adminProfile.phone,
    })
    .from(certificate)
    .leftJoin(submission, eq(submission.id, certificate.submissionId))
    .leftJoin(userProfile, eq(userProfile.id, certificate.generatedByAdminId))
    .leftJoin(adminProfile, eq(adminProfile.userId, certificate.generatedByAdminId))
    .where(eq(certificate.id, certificateId))
    .limit(1)

  if (!row) notFound()
  if (row.customerId !== user.id && user.role !== 'admin') notFound()

  // Fetch a short-lived signed URL for the stored signature PNG so we can inline it.
  let signatureDataUrl: string | null = null
  if (row.signatureStoragePath) {
    try {
      const supabase = createServiceClient()
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'
      const { data } = await supabase.storage
        .from(bucket)
        .download(row.signatureStoragePath)
      if (data) {
        const buf = Buffer.from(await data.arrayBuffer())
        signatureDataUrl = `data:image/png;base64,${buf.toString('base64')}`
      }
    } catch {
      // non-fatal — we'll render the handwritten fallback
    }
  }

  const basisLabel = BASIS_LABEL[row.path] ?? 'Rule 501(a)'
  const entityType =
    row.filingStatus === 'mfj' || row.filingStatus === 'spousal_equivalent'
      ? 'Joint'
      : 'Individual'
  const basisParagraph =
    row.path === 'income'
      ? `Income exceeded the applicable SEC threshold in each of the two most recent calendar years, with a reasonable expectation of reaching the same income level in ${new Date().getUTCFullYear()}.`
      : row.path === 'net_worth'
      ? 'Reviewed asset and liability documentation confirms total net worth (excluding primary residence) in excess of $1,000,000.'
      : row.path === 'entity_assets'
      ? 'Entity balance sheet confirms total assets in excess of $5,000,000, and the entity was not formed for the specific purpose of acquiring the securities offered.'
      : 'Documentation supports qualifying SEC Rule 501(a) accreditation status.'

  return (
    <>
      <AppHeader userId={user.id} userLabel={user.email} role={user.role === 'admin' ? 'admin' : 'customer'} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/letter"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            All certificates
          </Link>
          <div className="flex items-center gap-2">
            {row.revoked && <Badge variant="destructive">Revoked</Badge>}
            <Button asChild variant="gold" size="sm" disabled={row.revoked}>
              <Link href={`/api/certificates/${row.id}/download`}>
                <Download className="h-4 w-4" strokeWidth={1.8} />
                Download PDF
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/verify-public/${row.certificateNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                Public link
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-4 text-center">
          <div className="smallcaps text-[10px] text-slate-500">
            Certificate · issued {formatDateLong(row.issuedAt)}
          </div>
          <div className="mt-1 font-mono text-sm text-slate-700">
            {row.certificateNumber}
          </div>
        </div>

        <VerificationLetter
          data={{
            certificateNumber: row.certificateNumber,
            investorName: row.investorName ?? '—',
            entityType,
            basisLabel,
            issuedAt: row.issuedAt,
            validThrough: row.validThrough,
            cpaName: row.cpaName ?? 'AgFinTax CPA',
            cpaLicense: row.cpaLicense,
            cpaFirm: row.cpaFirm,
            cpaFirmAddress: row.cpaFirmCity,
            cpaEmail: row.cpaEmail,
            cpaPhone: row.cpaPhone,
            basisParagraph,
            signatureDataUrl,
          }}
        />
      </main>
    </>
  )
}
