import { and, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Bell, CheckCircle2, AlertCircle, Award, FileText } from 'lucide-react'
import { db } from '@/db/client'
import { notification } from '@/db/schema'
import { relativeTime } from '@/lib/utils'

/**
 * Server-component notification bell. Drops into the AppHeader.
 * Shows an unread count + a lightweight popover-like dropdown via <details>.
 */
export async function NotificationBell({ userId }: { userId: string }) {
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(10)

  const unread = rows.filter((r) => !r.read).length

  return (
    <details className="group relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container [&::-webkit-details-marker]:hidden">
        <Bell className="h-4 w-4" strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-2xl bg-surface-lowest shadow-ghost-lg">
        <div className="flex items-center justify-between border-b border-outline-variant/15 px-4 py-3">
          <h3 className="font-serif text-sm font-semibold text-primary">Notifications</h3>
          <span className="text-xs text-on-surface-variant">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-on-surface-variant">
              Nothing here yet.
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/15">
              {rows.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.relatedSubmissionId ? `/verify/${n.relatedSubmissionId}` : '/dashboard'}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-low ${
                      !n.read ? 'bg-secondary/5' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        n.type === 'approved' || n.type === 'letter_ready'
                          ? 'bg-[var(--success)]/10 text-[var(--success)]'
                          : n.type === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : n.type === 'changes_requested'
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-primary/5 text-primary'
                      }`}
                    >
                      {iconFor(n.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-on-surface">{n.title}</p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">
                          {n.body}
                        </p>
                      )}
                      <div className="mt-1 text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                        {relativeTime(n.createdAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  )
}

function iconFor(type: string) {
  switch (type) {
    case 'approved':
    case 'letter_ready':
      return <Award className="h-4 w-4" strokeWidth={1.8} />
    case 'rejected':
      return <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
    case 'changes_requested':
      return <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
    case 'submission_received':
      return <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
    default:
      return <FileText className="h-4 w-4" strokeWidth={1.8} />
  }
}

// fallback for unused suppression
void and
