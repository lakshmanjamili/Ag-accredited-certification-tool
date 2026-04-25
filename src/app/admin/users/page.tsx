import { desc, eq } from 'drizzle-orm'
import { Mail, Shield, User as UserIcon } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import { userProfile } from '@/db/schema'
import { createServiceClient } from '@/lib/supabase/server'
import { InviteForm } from './invite-form'
import { RoleControl } from './role-control'
import { relativeTime } from '@/lib/utils'

export default async function AdminUsersPage() {
  const me = await requireAdmin()

  // Public profile table (app's source of truth for role + name)
  const profiles = await db
    .select()
    .from(userProfile)
    .orderBy(desc(userProfile.createdAt))

  // Enrich with Supabase auth info (confirmed? last sign-in?)
  const sb = createServiceClient()
  const { data: authList } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  const authMap = new Map(
    authList?.users.map((u) => [
      u.id,
      {
        confirmed: !!u.email_confirmed_at,
        lastSignIn: u.last_sign_in_at ? new Date(u.last_sign_in_at) : null,
        banned: u.banned_until != null && new Date(u.banned_until) > new Date(),
      },
    ]) ?? [],
  )

  const admins = profiles.filter((p) => p.role === 'admin')
  const customers = profiles.filter((p) => p.role === 'customer')

  return (
    <>
            <main className="mx-auto max-w-6xl space-y-6 px-6 py-10 sm:px-8">
        <div>
          <div className="smallcaps text-[11px] text-slate-500">User management</div>
          <h1
            className="mt-0.5 font-serif text-[26px] leading-tight text-ink"
            style={{ fontWeight: 600 }}
          >
            Teammates &amp; investors
          </h1>
          <p className="text-[13px] text-slate-500">
            Everyone with access to AgFinTax. Invite new users, promote CPAs, resend magic
            links, or deactivate accounts.
          </p>
        </div>

        <InviteForm />

        <HowItWorks />

        <UserSection
          title="CPAs (admins)"
          subtitle="See the queue, review submissions, approve, sign certificates."
          count={admins.length}
          users={admins}
          authMap={authMap}
          currentUserId={me.id}
          emptyText="No admins besides you. Invite a CPA above."
        />

        <UserSection
          title="Investors (customers)"
          subtitle="Upload documents, attest, download certificates."
          count={customers.length}
          users={customers}
          authMap={authMap}
          currentUserId={me.id}
          emptyText="No investors yet. Invite the first one above."
        />
      </main>
    </>
  )
}

function HowItWorks() {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-bone p-5">
      <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
        How invites work
      </div>
      <ol className="mt-3 grid gap-4 text-[12.5px] text-slate-700 sm:grid-cols-3">
        <Step n="01" title="You invite" body="Enter name + email + role. We call Supabase admin API." />
        <Step
          n="02"
          title="They receive email"
          body="Supabase sends a branded invite with a magic link. Edit template in Supabase → Auth → Email Templates."
        />
        <Step
          n="03"
          title="They sign in"
          body="Clicking the link auto-signs them in. They're redirected to /dashboard (customer) or /admin (admin)."
        />
      </ol>
      <div className="mt-3 text-[11px] text-slate-500">
        Role is stored in <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">auth.users.app_metadata.role</code>{' '}
        (tamper-proof from the client). Trigger mirrors it to{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">user_profile.role</code>.
      </div>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-[6px] border border-slate-200 bg-paper p-3">
      <div className="font-serif text-[18px] text-gold" style={{ fontWeight: 500 }}>
        {n}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-ink">{title}</div>
      <div className="mt-0.5 text-[11px] leading-[1.5] text-slate-500">{body}</div>
    </div>
  )
}

type AuthMeta = { confirmed: boolean; lastSignIn: Date | null; banned: boolean }

function UserSection({
  title,
  subtitle,
  count,
  users,
  authMap,
  currentUserId,
  emptyText,
}: {
  title: string
  subtitle: string
  count: number
  users: { id: string; email: string; fullName: string | null; role: 'customer' | 'admin'; createdAt: Date }[]
  authMap: Map<string, AuthMeta>
  currentUserId: string
  emptyText: string
}) {
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-[18px] text-ink" style={{ fontWeight: 600 }}>
            {title}
            <span className="ml-2 text-[13px] font-normal text-slate-500">({count})</span>
          </h2>
          <p className="text-[12px] text-slate-500">{subtitle}</p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-slate-200 bg-bone p-8 text-center text-[13px] text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-paper elev">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-slate-100 bg-bone">
              <tr className="text-left text-slate-500">
                <th className="smallcaps px-5 py-2.5 text-[10px] font-medium">User</th>
                <th className="smallcaps px-5 py-2.5 text-[10px] font-medium">Status</th>
                <th className="smallcaps px-5 py-2.5 text-[10px] font-medium">Last sign-in</th>
                <th className="smallcaps px-5 py-2.5 text-[10px] font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const meta = authMap.get(u.id)
                const isMe = u.id === currentUserId
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-bone"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                          style={{
                            background: u.role === 'admin' ? 'var(--ink)' : 'var(--slate-500)',
                          }}
                        >
                          {initials(u.fullName, u.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {u.fullName ?? u.email.split('@')[0]}
                            {isMe && (
                              <span className="smallcaps ml-2 text-[9px] tracking-widest text-slate-400">
                                You
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.role === 'admin' ? (
                          <RoleChip icon={<Shield className="h-3 w-3" strokeWidth={2} />} label="Admin" tone="ink" />
                        ) : (
                          <RoleChip icon={<UserIcon className="h-3 w-3" strokeWidth={2} />} label="Investor" tone="slate" />
                        )}
                        {meta?.banned ? (
                          <RoleChip
                            icon={<Mail className="h-3 w-3" strokeWidth={2} />}
                            label="Deactivated"
                            tone="danger"
                          />
                        ) : meta?.confirmed ? (
                          <RoleChip
                            icon={<Mail className="h-3 w-3" strokeWidth={2} />}
                            label="Confirmed"
                            tone="success"
                          />
                        ) : (
                          <RoleChip
                            icon={<Mail className="h-3 w-3" strokeWidth={2} />}
                            label="Pending invite"
                            tone="warn"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {meta?.lastSignIn ? relativeTime(meta.lastSignIn) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <RoleControl
                          userId={u.id}
                          email={u.email}
                          currentRole={u.role}
                          disabled={isMe}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RoleChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode
  label: string
  tone: 'ink' | 'slate' | 'success' | 'warn' | 'danger'
}) {
  const toneClasses: Record<string, string> = {
    ink: 'bg-ink/5 text-ink',
    slate: 'bg-slate-100 text-slate-700',
    success: 'bg-[var(--success-50)] text-[var(--success)]',
    warn: 'bg-[var(--warn-50)] text-[var(--warn)]',
    danger: 'bg-[var(--danger-50)] text-[var(--danger)]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${toneClasses[tone]}`}
    >
      {icon}
      {label}
    </span>
  )
}

function initials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
  }
  const name = email.split('@')[0]
  return (name[0] ?? '?').toUpperCase() + (name[1] ?? '').toUpperCase()
}

// Silence unused import warning for eq — scoped for future filtering
void eq
