'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Inbox,
  FileSignature,
  Users,
  Settings,
  Search,
  LogOut,
  ChevronsUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/ui/wordmark'

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/queue', label: 'Queue', icon: Inbox },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/profile', label: 'CPA Profile', icon: Settings },
] as const
// Future: /admin/submissions index, /admin/letters archive, /admin/audit log
void FileSignature

export function AdminShell({
  userLabel,
  userName,
  notificationBell,
  children,
}: {
  userLabel: string
  userName: string
  /** Server-rendered <NotificationBell userId={...}/> passed in as a slot */
  notificationBell?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isActive = (href: string, exact: boolean | undefined) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const firstName = userName.split(/\s+/)[0] ?? userLabel.split('@')[0]
  const initials = avatarInitials(userName || userLabel)

  return (
    <div className="flex min-h-screen bg-bone">
      {/* Left sidebar — desktop */}
      <aside
        className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-slate-200 bg-paper lg:flex"
      >
        <div className="border-b border-slate-200 px-5 py-5">
          <Link href="/admin" className="block">
            <Wordmark size="sm" />
          </Link>
          <div className="smallcaps mt-1 text-[10.5px] tracking-[.18em] text-slate-500">
            CPA Workspace
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {NAV.map((item) => {
            const active = isActive(item.href, 'exact' in item ? item.exact : false)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-[6px] px-3 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-bone text-ink'
                    : 'text-slate-600 hover:bg-bone hover:text-ink',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    active ? 'text-ink' : 'text-slate-500',
                  )}
                  strokeWidth={1.8}
                />
                <span className="flex-1 text-left">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-[6px] p-2 hover:bg-bone">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-gold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold leading-tight text-slate-900">
                {userName || userLabel.split('@')[0]}
              </div>
              <div className="truncate text-[10.5px] leading-tight text-slate-500">
                {userLabel}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
          </div>

          <form action="/sign-out" method="post" className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-[6px] py-2 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-[var(--danger-50)] hover:text-[var(--danger)]"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-paper/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            {/* Mobile wordmark */}
            <Link href="/admin" className="lg:hidden">
              <Wordmark size="sm" />
            </Link>

            {/* Search */}
            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                strokeWidth={1.8}
              />
              <input
                type="text"
                placeholder="Search submissions, letters, investors…"
                className="h-9 w-full rounded-[6px] border border-slate-200 bg-bone pl-9 pr-3 text-[13px] focus:bg-paper"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile nav — compressed icons */}
              <nav className="flex items-center gap-0.5 lg:hidden">
                {NAV.map((item) => {
                  const active = isActive(item.href, 'exact' in item ? item.exact : false)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors',
                        active ? 'bg-bone text-ink' : 'text-slate-500 hover:bg-bone',
                      )}
                      title={item.label}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                  )
                })}
              </nav>

              {notificationBell}

              <div className="hidden text-[12px] text-slate-500 xl:block">
                <span className="font-semibold text-slate-900">Good morning, {firstName}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

function avatarInitials(s: string): string {
  const parts = s.trim().split(/[\s@]+/)
  return (
    ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
  )
}
