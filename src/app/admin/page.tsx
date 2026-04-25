import Link from 'next/link'
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  Inbox,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Award,
  FileCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import {
  submission,
  certificate,
  userProfile,
  reviewDecision,
  auditLog,
  notification,
} from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { relativeTime, formatDateShort } from '@/lib/utils'

export default async function AdminOverviewPage() {
  const admin = await requireAdmin()
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // ─── KPI queries, all in parallel ────────────────────────────────────
  const [
    unassigned,
    myQueue,
    approvedToday,
    letterGeneratedThisWeek,
    totalCustomers,
    recentDecisions,
    recentActivity,
    oldestUnassigned,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(submission)
      .where(
        and(
          eq(submission.status, 'pending_admin_review'),
          isNull(submission.assignedAdminId),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(submission)
      .where(
        and(
          eq(submission.assignedAdminId, admin.id),
          inArray(submission.status, ['assigned', 'in_review', 'changes_requested']),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewDecision)
      .where(
        and(
          eq(reviewDecision.adminId, admin.id),
          eq(reviewDecision.decision, 'approve'),
          gte(reviewDecision.createdAt, dayAgo),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificate)
      .where(
        and(
          eq(certificate.generatedByAdminId, admin.id),
          gte(certificate.issuedAt, weekAgo),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfile)
      .where(eq(userProfile.role, 'customer')),
    db
      .select({
        id: reviewDecision.id,
        decision: reviewDecision.decision,
        notes: reviewDecision.notes,
        createdAt: reviewDecision.createdAt,
        submissionId: reviewDecision.submissionId,
        investorName: submission.investorName,
        customerEmail: userProfile.email,
      })
      .from(reviewDecision)
      .leftJoin(submission, eq(submission.id, reviewDecision.submissionId))
      .leftJoin(userProfile, eq(userProfile.id, submission.customerId))
      .where(eq(reviewDecision.adminId, admin.id))
      .orderBy(desc(reviewDecision.createdAt))
      .limit(5),
    db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(8),
    db
      .select({
        id: submission.id,
        submittedAt: submission.submittedAt,
        investorName: submission.investorName,
        customerEmail: userProfile.email,
      })
      .from(submission)
      .leftJoin(userProfile, eq(userProfile.id, submission.customerId))
      .where(
        and(
          eq(submission.status, 'pending_admin_review'),
          isNull(submission.assignedAdminId),
        ),
      )
      .orderBy(submission.submittedAt)
      .limit(3),
  ])

  const unassignedCount = unassigned[0]?.count ?? 0
  const myQueueCount = myQueue[0]?.count ?? 0
  const approvedTodayCount = approvedToday[0]?.count ?? 0
  const weekCerts = letterGeneratedThisWeek[0]?.count ?? 0
  const customerCount = totalCustomers[0]?.count ?? 0

  const oldestWait = oldestUnassigned[0]?.submittedAt
    ? Math.floor((Date.now() - oldestUnassigned[0].submittedAt.getTime()) / (60 * 60 * 1000))
    : null

  void or, void notification

  return (
    <>
            <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-navy-gradient p-8 text-white shadow-ghost-lg sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />
          <div className="relative">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
              CPA Workspace · Welcome
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">
              {greeting()}
              <span className="italic text-secondary"> {admin.fullName?.split(/\s+/)[0] ?? 'Reviewer'}.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-lg">
              {unassignedCount > 0
                ? `${unassignedCount} submission${unassignedCount === 1 ? ' is' : 's are'} waiting to be claimed.`
                : myQueueCount > 0
                ? `${myQueueCount} submission${myQueueCount === 1 ? '' : 's'} in your queue. Nothing waiting.`
                : 'All clear. Nothing in the queue right now.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/admin/queue?tab=available">
                  <Inbox className="h-4 w-4" strokeWidth={1.8} />
                  Open available queue
                </Link>
              </Button>
              {myQueueCount > 0 && (
                <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/admin/queue?tab=mine">
                    <Users className="h-4 w-4" strokeWidth={1.8} />
                    My queue ({myQueueCount})
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            icon={<Inbox className="h-5 w-5" strokeWidth={1.8} />}
            label="Unassigned"
            value={unassignedCount}
            accent={unassignedCount > 0}
            hint={oldestWait != null ? `Oldest ${oldestWait}h waiting` : 'All claimed'}
          />
          <Kpi
            icon={<Users className="h-5 w-5" strokeWidth={1.8} />}
            label="My queue"
            value={myQueueCount}
            accent={myQueueCount > 0}
            hint="Assigned to you"
          />
          <Kpi
            icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />}
            label="Approved today"
            value={approvedTodayCount}
            hint="Last 24 hours"
          />
          <Kpi
            icon={<Award className="h-5 w-5" strokeWidth={1.8} />}
            label="Certificates this week"
            value={weekCerts}
            hint="Letters issued"
          />
        </div>

        {/* Secondary stats */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <SecondaryKpi
            icon={<Users className="h-4 w-4" strokeWidth={1.8} />}
            label="Total customers"
            value={customerCount.toLocaleString()}
          />
          <SecondaryKpi
            icon={<Clock className="h-4 w-4" strokeWidth={1.8} />}
            label="Oldest waiting"
            value={
              oldestWait == null
                ? '—'
                : oldestWait >= 24
                ? `${Math.floor(oldestWait / 24)}d ${oldestWait % 24}h`
                : `${oldestWait}h`
            }
            severity={oldestWait != null && oldestWait >= 24 ? 'warning' : 'info'}
          />
          <SecondaryKpi
            icon={<TrendingUp className="h-4 w-4" strokeWidth={1.8} />}
            label="Active CPAs"
            value="—"
            hint="Coming soon"
          />
        </div>

        {/* Content grid */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr,380px]">
          {/* Recent decisions */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Your recent decisions
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Last 5 review decisions you signed off on.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/queue?tab=completed">
                    See all
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </Link>
                </Button>
              </div>
              {recentDecisions.length === 0 ? (
                <div className="rounded-xl bg-surface-low p-8 text-center text-sm text-on-surface-variant">
                  No decisions yet. Claim something from the queue to get started.
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/15">
                  {recentDecisions.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/admin/submissions/${d.submissionId}`}
                        className="flex items-start gap-3 py-3 transition-colors hover:bg-surface-low/50 first:pt-0 last:pb-0 -mx-2 px-2 rounded-lg"
                      >
                        <div className="mt-1 shrink-0">
                          <DecisionIcon decision={d.decision} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-on-surface">
                              {d.investorName ?? d.customerEmail ?? 'Unknown'}
                            </span>
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
                          </div>
                          {d.notes && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">
                              {d.notes}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-on-surface-variant">
                          {relativeTime(d.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Waiting list */}
            {oldestUnassigned.length > 0 && (
              <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
                <h2 className="font-serif text-xl font-semibold text-primary">
                  Waiting for a CPA
                </h2>
                <p className="mb-4 text-sm text-on-surface-variant">
                  Oldest unassigned submissions. Claim fast so customers don&apos;t wait.
                </p>
                <ul className="space-y-2">
                  {oldestUnassigned.map((s) => {
                    const ageH =
                      s.submittedAt != null
                        ? Math.floor((Date.now() - s.submittedAt.getTime()) / 3600000)
                        : 0
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-surface-low p-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-on-surface">
                            {s.investorName ?? s.customerEmail ?? 'Unknown'}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            Submitted{' '}
                            {s.submittedAt ? relativeTime(s.submittedAt) : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {ageH >= 24 && (
                            <Badge variant="warning" className="shrink-0">
                              {Math.floor(ageH / 24)}d{ageH % 24 ? ` ${ageH % 24}h` : ''}
                            </Badge>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/submissions/${s.id}`}>Open</Link>
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div>
            <div className="rounded-3xl bg-surface-lowest p-6 shadow-ghost">
              <div className="mb-4">
                <h2 className="font-serif text-xl font-semibold text-primary">
                  Recent activity
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Everything that happened across the platform.
                </p>
              </div>
              {recentActivity.length === 0 ? (
                <div className="rounded-xl bg-surface-low p-6 text-center text-sm text-on-surface-variant">
                  No activity yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--primary)] ${
                          a.action.includes('approve') || a.action.includes('sign_and_generate')
                            ? 'bg-[var(--success)]/10 text-[var(--success)]'
                            : a.action.includes('reject') || a.action.includes('revoke')
                            ? 'bg-destructive/10 text-destructive'
                            : a.action.includes('claim') || a.action.includes('release')
                            ? 'bg-secondary/10 text-secondary'
                            : 'bg-primary/5'
                        }`}
                      >
                        <ActivityIcon action={a.action} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-on-surface">
                          {actionLabel(a.action)}
                          <span className="text-on-surface-variant">
                            {a.subjectType ? ` · ${a.subjectType}` : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                          {relativeTime(a.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function Kpi({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  hint?: string
  accent?: boolean
}) {
  return (
    <Card className={accent ? 'ring-2 ring-secondary/30' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              accent ? 'bg-secondary/10 text-secondary' : 'bg-primary/5 text-primary'
            }`}
          >
            {icon}
          </div>
          {accent && <AlertTriangle className="h-4 w-4 text-secondary" strokeWidth={1.8} />}
        </div>
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {label}
          </div>
          <div className="mt-1 font-serif text-4xl font-semibold tabular-nums tracking-tight text-primary">
            {value}
          </div>
          {hint && (
            <div className="mt-1 text-xs text-on-surface-variant">{hint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SecondaryKpi({
  icon,
  label,
  value,
  hint,
  severity = 'info',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  severity?: 'info' | 'warning'
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-surface-lowest p-4 shadow-ghost ${
        severity === 'warning' ? 'ring-1 ring-secondary/30' : ''
      }`}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          severity === 'warning' ? 'bg-secondary/10 text-secondary' : 'bg-primary/5 text-primary'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </div>
        <div className="font-serif text-xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {hint && <div className="text-[10px] text-on-surface-variant">{hint}</div>}
      </div>
    </div>
  )
}

function DecisionIcon({ decision }: { decision: string }) {
  if (decision === 'approve')
    return <CheckCircle2 className="h-5 w-5 text-[var(--success)]" strokeWidth={1.8} />
  if (decision === 'reject')
    return <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.8} />
  return <Clock className="h-5 w-5 text-secondary" strokeWidth={1.8} />
}

function ActivityIcon({ action }: { action: string }) {
  if (action.includes('claim'))
    return <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('release'))
    return <Inbox className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('approve'))
    return <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('reject'))
    return <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('sign') || action.includes('generate'))
    return <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('revoke'))
    return <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
  if (action.includes('download'))
    return <FileCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
  return <FileCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
}

function actionLabel(action: string): string {
  switch (action) {
    case 'claim':
      return 'Claimed a submission'
    case 'release':
      return 'Released a submission'
    case 'decision:approve':
      return 'Approved a submission'
    case 'decision:reject':
      return 'Rejected a submission'
    case 'decision:request_changes':
      return 'Requested changes'
    case 'certificate:sign_and_generate':
      return 'Generated a certificate'
    case 'certificate:revoke':
      return 'Revoked a certificate'
    case 'certificate:download:pdf':
      return 'PDF downloaded'
    case 'certificate:download:docx':
      return 'DOCX downloaded'
    default:
      return action.replace(/[:_]/g, ' ')
  }
}
