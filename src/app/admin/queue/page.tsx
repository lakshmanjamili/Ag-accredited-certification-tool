import Link from 'next/link'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import { submission, userProfile } from '@/db/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateShort, relativeTime } from '@/lib/utils'
import { ClaimButton } from '@/components/admin/claim-button'
import { ArrowRight } from 'lucide-react'

type Tab = 'available' | 'mine' | 'all' | 'completed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'available', label: 'Available' },
  { id: 'mine', label: 'My Queue' },
  { id: 'all', label: 'All Pending' },
  { id: 'completed', label: 'Completed' },
]

type SearchParams = Promise<{ tab?: Tab }>

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin()
  const { tab = 'available' } = await searchParams

  const rows = await fetchRows(tab, admin.id)

  return (
    <>
            <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Review Queue</h1>
        <p className="mt-2 text-muted-foreground">Claim a pending submission, or continue your own.</p>

        <div className="mt-8 flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/admin/queue?tab=${t.id}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No submissions here.
              </CardContent>
            </Card>
          ) : (
            rows.map((row) => (
              <Card key={row.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {row.investorName ?? row.customerEmail} ·{' '}
                      <span className="capitalize text-muted-foreground">
                        {row.verificationPath?.replace('_', ' ') ?? '—'}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {row.customerEmail} · {row.filingStatus?.toUpperCase() ?? '—'} · submitted{' '}
                      {row.submittedAt ? relativeTime(row.submittedAt) : '—'}
                      {row.submittedAt && ` (${formatDateShort(row.submittedAt)})`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={row.status} />
                    {row.assigneeEmail && (
                      <Badge variant="outline" className="text-xs">
                        {row.assigneeEmail === admin.email ? 'You' : row.assigneeEmail}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="text-xs font-mono text-muted-foreground">{row.id.slice(0, 8)}</div>
                  <div className="flex gap-2">
                    {tab === 'available' && !row.assignedAdminId && (
                      <ClaimButton submissionId={row.id} />
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/submissions/${row.id}`}>
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  )
}

async function fetchRows(tab: Tab, adminId: string) {
  const customer = alias(userProfile, 'customer')
  const assignee = alias(userProfile, 'assignee')

  const base = db
    .select({
      id: submission.id,
      status: submission.status,
      verificationPath: submission.verificationPath,
      filingStatus: submission.filingStatus,
      investorName: submission.investorName,
      submittedAt: submission.submittedAt,
      assignedAdminId: submission.assignedAdminId,
      customerEmail: customer.email,
      assigneeEmail: assignee.email,
    })
    .from(submission)
    .leftJoin(customer, eq(submission.customerId, customer.id))
    .leftJoin(assignee, eq(submission.assignedAdminId, assignee.id))

  if (tab === 'available') {
    return base
      .where(and(eq(submission.status, 'pending_admin_review'), isNull(submission.assignedAdminId)))
      .orderBy(desc(submission.submittedAt))
  }
  if (tab === 'mine') {
    return base
      .where(
        and(
          eq(submission.assignedAdminId, adminId),
          inArray(submission.status, ['assigned', 'in_review', 'changes_requested']),
        ),
      )
      .orderBy(desc(submission.submittedAt))
  }
  if (tab === 'completed') {
    return base
      .where(
        and(
          eq(submission.assignedAdminId, adminId),
          inArray(submission.status, ['approved', 'rejected', 'letter_generated']),
        ),
      )
      .orderBy(desc(submission.submittedAt))
  }
  // all-pending
  return base
    .where(
      inArray(submission.status, [
        'pending_admin_review',
        'assigned',
        'in_review',
        'changes_requested',
      ]),
    )
    .orderBy(desc(submission.submittedAt))
}

function StatusBadge({ status }: { status: string }) {
  type V = 'default' | 'accent' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
  const map: Record<string, { label: string; variant: V }> = {
    pending_admin_review: { label: 'Unassigned', variant: 'accent' },
    assigned: { label: 'Assigned', variant: 'default' },
    in_review: { label: 'In review', variant: 'default' },
    changes_requested: { label: 'Changes requested', variant: 'warning' },
    approved: { label: 'Approved', variant: 'success' },
    rejected: { label: 'Rejected', variant: 'destructive' },
    letter_generated: { label: 'Letter issued', variant: 'success' },
  }
  const m = map[status] ?? { label: status, variant: 'outline' as const }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
