import { eq } from 'drizzle-orm'
import { ShieldCheck, XCircle, Clock } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { db } from '@/db/client'
import { certificate, submission, userProfile, adminProfile } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { formatDateLong } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Params = Promise<{ certNumber: string }>

export default async function PublicVerifyPage({ params }: { params: Params }) {
  const { certNumber } = await params

  const [row] = await db
    .select({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      path: certificate.path,
      issuedAt: certificate.issuedAt,
      validThrough: certificate.validThrough,
      revoked: certificate.revoked,
      revocationReason: certificate.revocationReason,
      investorName: submission.investorName,
      firmName: adminProfile.firmName,
      cpaName: userProfile.fullName,
    })
    .from(certificate)
    .leftJoin(submission, eq(submission.id, certificate.submissionId))
    .leftJoin(userProfile, eq(userProfile.id, certificate.generatedByAdminId))
    .leftJoin(adminProfile, eq(adminProfile.userId, certificate.generatedByAdminId))
    .where(eq(certificate.certificateNumber, certNumber))
    .limit(1)

  const state: 'valid' | 'expired' | 'revoked' | 'not_found' = !row
    ? 'not_found'
    : row.revoked
    ? 'revoked'
    : row.validThrough.getTime() < Date.now()
    ? 'expired'
    : 'valid'

  // Initials only — no PII on public page.
  const initials = row?.investorName
    ? row.investorName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .slice(0, 3)
        .join('. ') + '.'
    : null

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[color-mix(in_oklab,var(--primary)_4%,white)] via-background to-background">
      <header className="mx-auto w-full max-w-3xl px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--secondary)] text-sm font-bold text-white">
            Ag
          </div>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 items-start px-6 pb-16">
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Certificate
          </div>
          <div className="mb-6 font-mono text-lg font-semibold tracking-tight">{certNumber}</div>

          {state === 'valid' && row && (
            <>
              <StatusRow
                icon={<ShieldCheck className="h-5 w-5" />}
                badge={<Badge variant="success">VALID</Badge>}
                label="Verified accredited investor"
              />
              <div className="mt-6 grid gap-3 text-sm">
                <Row label="Investor" value={initials ?? '—'} />
                <Row label="Path" value={row.path.replace('_', ' ')} />
                <Row label="Issued" value={formatDateLong(row.issuedAt)} />
                <Row label="Valid through" value={formatDateLong(row.validThrough)} />
                <Row label="Issuing firm" value={row.firmName ?? BRAND.legal} />
                <Row label="CPA on file" value={row.cpaName ?? '—'} />
              </div>
            </>
          )}
          {state === 'expired' && row && (
            <StatusRow
              icon={<Clock className="h-5 w-5" />}
              badge={<Badge variant="warning">EXPIRED</Badge>}
              label={`Expired ${formatDateLong(row.validThrough)}`}
            />
          )}
          {state === 'revoked' && row && (
            <>
              <StatusRow
                icon={<XCircle className="h-5 w-5" />}
                badge={<Badge variant="destructive">REVOKED</Badge>}
                label="This certificate has been revoked"
              />
              {row.revocationReason && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {row.revocationReason}
                </p>
              )}
            </>
          )}
          {state === 'not_found' && (
            <StatusRow
              icon={<XCircle className="h-5 w-5" />}
              badge={<Badge variant="outline">UNKNOWN</Badge>}
              label="No matching certificate."
            />
          )}

          <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
            This page confirms the issuance status of an accredited-investor verification letter
            issued by {BRAND.legal}. No personally identifiable information is disclosed.
          </p>
        </div>
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-right font-medium capitalize">{value}</div>
    </div>
  )
}

function StatusRow({
  icon,
  badge,
  label,
}: {
  icon: React.ReactNode
  badge: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card text-[var(--primary)]">
        {icon}
      </div>
      <div className="flex-1">
        <div className="mb-1">{badge}</div>
        <div className="text-sm text-foreground">{label}</div>
      </div>
    </div>
  )
}
