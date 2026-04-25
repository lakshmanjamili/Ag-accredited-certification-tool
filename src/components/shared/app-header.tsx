import Link from 'next/link'
import { Wordmark } from '@/components/ui/wordmark'
import { SignOutButton } from './sign-out-button'
import { NotificationBell } from './notification-bell'

export function AppHeader({
  userId,
  userLabel,
  role,
}: {
  userId?: string
  userLabel: string
  role: 'customer' | 'admin'
}) {
  const links =
    role === 'admin'
      ? [
          { href: '/admin', label: 'Overview' },
          { href: '/admin/queue', label: 'Queue' },
          { href: '/admin/users', label: 'Users' },
          { href: '/admin/profile', label: 'Profile' },
        ]
      : [
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/verify', label: 'Verify' },
          { href: '/letter', label: 'Letter' },
          { href: '/profile', label: 'Profile' },
        ]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Link
          href={role === 'admin' ? '/admin' : '/dashboard'}
          className="flex items-center gap-3"
        >
          <Wordmark size="sm" />
          <span className="hidden text-[12px] text-slate-500 sm:inline">
            {role === 'admin' ? 'CPA workspace' : 'Investor portal'}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-[13.5px] text-slate-600 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-medium transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {userId && <NotificationBell userId={userId} />}
          <div className="hidden items-center gap-2.5 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">
              {initials(userLabel)}
            </div>
            <div className="hidden md:block">
              <div className="text-[13px] font-semibold leading-tight text-slate-900">
                {userLabel.split('@')[0]}
              </div>
              <div className="text-[11px] leading-tight text-slate-500">{userLabel}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}

function initials(s: string): string {
  const name = s.split('@')[0] ?? s
  return (name[0] ?? '?').toUpperCase() + (name[1] ?? '').toUpperCase()
}
