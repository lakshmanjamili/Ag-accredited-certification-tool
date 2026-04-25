import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import {
  ArrowRight,
  FileText,
  Plus,
  Sparkles,
  ShieldCheck,
  Clock,
  Award,
  Download,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db/client'
import { submission, certificate, document } from '@/db/schema'
import { AppHeader } from '@/components/shared/app-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateLong, relativeTime } from '@/lib/utils'

export default async function DashboardPage() {
  const user = await requireUser()
  if (user.role === 'admin') redirect('/admin')

  const [subs, certs, docsCountRow] = await Promise.all([
    db
      .select()
      .from(submission)
      .where(eq(submission.customerId, user.id))
      .orderBy(desc(submission.updatedAt)),
    db
      .select({
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
        path: certificate.path,
        issuedAt: certificate.issuedAt,
        validThrough: certificate.validThrough,
        revoked: certificate.revoked,
        submissionId: certificate.submissionId,
      })
      .from(certificate)
      .innerJoin(submission, eq(submission.id, certificate.submissionId))
      .where(eq(submission.customerId, user.id))
      .orderBy(desc(certificate.issuedAt)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(document)
      .innerJoin(submission, eq(submission.id, document.submissionId))
      .where(eq(submission.customerId, user.id)),
  ])

  const validCert = certs.find(
    (c) => !c.revoked && c.validThrough.getTime() > Date.now(),
  )
  const openSub = subs.find((s) =>
    ['draft', 'changes_requested', 'pending_admin_review', 'assigned', 'in_review', 'approved'].includes(
      s.status,
    ),
  )
  const docCount = docsCountRow[0]?.count ?? 0
  const firstName = (user.fullName ?? '').split(/\s+/)[0] || 'there'

  return (
    <>
      <AppHeader userId={user.id} userLabel={user.email} role="customer" />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-navy-gradient p-8 text-white shadow-ghost-lg sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />
          <div className="pointer-events-none absolute right-8 bottom-6 hidden opacity-10 sm:block">
            <ShieldCheck className="h-40 w-40" strokeWidth={1} />
          </div>
          <div className="relative">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
              {validCert ? 'Accredited' : 'AgFinTax Ledger'}
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">
              {greeting()}
              <span className="italic text-secondary"> {firstName}.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {validCert
                ? `You have an active accreditation certificate — valid through ${formatDateLong(validCert.validThrough)}. Share it with any issuer.`
                : openSub
                ? ctaCopy(openSub.status)
                : 'Let\'s verify your accredited-investor status. Upload documents, CPA reviews, certificate arrives in under 24 hours.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {openSub ? (
                <Button asChild variant="accent" size="lg">
                  <Link href={`/verify/${openSub.id}`}>
                    Continue submission
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="accent" size="lg">
                  <Link href="/verify">
                    Start new verification
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                </Button>
              )}
              {validCert && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-white/30 bg-white/5 text-white hover:bg-white/10"
                >
                  <Link href={`/api/certificates/${validCert.id}/download`}>
                    <Download className="h-4 w-4" strokeWidth={1.8} />
                    Download certificate
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<FileText className="h-4 w-4" strokeWidth={1.8} />}
            label="Submissions"
            value={subs.length}
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.8} />}
            label="Documents uploaded"
            value={docCount}
          />
          <StatCard
            icon={<Award className="h-4 w-4" strokeWidth={1.8} />}
            label="Certificates earned"
            value={certs.length}
            accent={validCert != null}
          />
        </div>

        {/* Active submission callout */}
        {openSub && (
          <Link
            href={`/verify/${openSub.id}`}
            className="group flex items-center justify-between gap-6 rounded-2xl bg-surface-lowest p-6 shadow-ghost transition-shadow hover:shadow-ghost-lg"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  openSub.status === 'changes_requested'
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-primary/5 text-primary'
                }`}
              >
                <StatusIcon status={openSub.status} />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
                    {openSub.status === 'changes_requested'
                      ? 'Action needed'
                      : openSub.status === 'draft'
                      ? 'In progress'
                      : 'Under CPA review'}
                  </span>
                  <StatusBadge status={openSub.status} />
                </div>
                <h3 className="font-serif text-xl font-semibold italic text-primary">
                  {openSub.verificationPath
                    ? `${openSub.verificationPath.replace('_', ' ')} path`
                    : 'Verification'}{' '}
                  · started {relativeTime(openSub.createdAt)}
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {ctaCopy(openSub.status)}
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-1 group-hover:text-primary"
              strokeWidth={1.8}
            />
          </Link>
        )}

        {/* Certificates section */}
        {certs.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Your certificates
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Accredited-investor letters issued for you.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/letter">Open Vault</Link>
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {certs.slice(0, 4).map((c) => (
                <CertificateCard key={c.id} cert={c} />
              ))}
            </div>
          </section>
        )}

        {/* All submissions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-semibold text-primary">
              All submissions
            </h2>
            <Button asChild variant="accent" size="sm">
              <Link href="/verify">
                <Plus className="h-4 w-4" strokeWidth={2} />
                New
              </Link>
            </Button>
          </div>

          {subs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-2xl bg-surface-lowest shadow-ghost">
              {subs.map((row) => (
                <Link
                  key={row.id}
                  href={`/verify/${row.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-low/50"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                      <StatusIcon status={row.status} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-on-surface">
                        {row.investorName ??
                          (row.verificationPath
                            ? `${row.verificationPath.replace('_', ' ')} verification`
                            : 'Verification')}
                      </div>
                      <div className="text-xs text-on-surface-variant">
                        Updated {relativeTime(row.updatedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={row.status} />
                    <ArrowRight
                      className="h-4 w-4 text-on-surface-variant/50 transition-transform group-hover:translate-x-1 group-hover:text-primary"
                      strokeWidth={1.8}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function ctaCopy(status: string): string {
  switch (status) {
    case 'draft':
      return 'Keep going — drop your documents and submit when ready.'
    case 'changes_requested':
      return 'Your CPA asked for an update. Open the submission to see their note.'
    case 'pending_admin_review':
      return 'You are in the CPA review queue. Typical turnaround is under 24 hours.'
    case 'assigned':
    case 'in_review':
      return 'Your CPA is actively reviewing right now.'
    case 'approved':
      return 'Approved — your certificate is being generated.'
    default:
      return 'Open the submission to see the latest.'
  }
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-2xl bg-surface-lowest p-5 shadow-ghost ${
        accent ? 'ring-2 ring-secondary/30' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            accent ? 'bg-secondary/10 text-secondary' : 'bg-primary/5 text-primary'
          }`}
        >
          {icon}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </div>
      </div>
      <div className="mt-3 font-serif text-3xl font-semibold tabular-nums tracking-tight text-primary">
        {value}
      </div>
    </div>
  )
}

function CertificateCard({
  cert,
}: {
  cert: {
    id: string
    certificateNumber: string
    path: 'income' | 'net_worth' | 'professional' | 'entity_assets'
    issuedAt: Date
    validThrough: Date
    revoked: boolean
    submissionId: string
  }
}) {
  const expired = cert.validThrough.getTime() < Date.now()
  const state = cert.revoked ? 'revoked' : expired ? 'expired' : 'valid'

  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy-gradient p-6 text-white shadow-ghost">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-10">
        <Award className="h-32 w-32" strokeWidth={1} />
      </div>
      <div className="relative">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
          {state === 'valid' ? 'Valid certificate' : state === 'expired' ? 'Expired' : 'Revoked'}
        </div>
        <div className="font-mono text-sm font-semibold">{cert.certificateNumber}</div>
        <div className="mt-1 text-xs capitalize text-white/60">
          {cert.path.replace('_', ' ')} path
        </div>
        <div className="mt-4 text-xs text-white/70">
          Valid through {formatDateLong(cert.validThrough)}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            asChild
            size="sm"
            variant="accent"
            disabled={cert.revoked}
          >
            <Link href={`/api/certificates/${cert.id}/download`}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
              Download PDF
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface-lowest p-12 text-center shadow-ghost">
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <Sparkles className="mx-auto h-full w-full text-primary" strokeWidth={0.5} />
      </div>
      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary">
          <FileText className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h3 className="mt-4 font-serif text-xl font-semibold text-primary">
          No submissions yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
          Start with the verification path that fits you best. Our AI reads your documents
          and a licensed CPA signs off.
        </p>
        <Button asChild variant="accent" size="lg" className="mt-6">
          <Link href="/verify">
            Start verification
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'approved' || status === 'letter_generated')
    return <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
  if (status === 'changes_requested')
    return <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
  if (status === 'rejected')
    return <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
  if (status === 'pending_admin_review' || status === 'assigned' || status === 'in_review')
    return <Clock className="h-4 w-4" strokeWidth={1.8} />
  return <FileText className="h-4 w-4" strokeWidth={1.8} />
}

function StatusBadge({ status }: { status: string }) {
  type V = 'default' | 'accent' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
  const map: Record<string, { label: string; variant: V }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    pending_extraction: { label: 'Extracting', variant: 'secondary' },
    pending_admin_review: { label: 'Pending review', variant: 'accent' },
    assigned: { label: 'In review', variant: 'accent' },
    in_review: { label: 'In review', variant: 'accent' },
    changes_requested: { label: 'Changes requested', variant: 'warning' },
    approved: { label: 'Approved', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    letter_generated: { label: 'Letter ready', variant: 'success' },
  }
  const m = map[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
