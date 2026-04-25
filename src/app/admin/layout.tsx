import { requireAdmin } from '@/lib/auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { NotificationBell } from '@/components/shared/notification-bell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  return (
    <AdminShell
      userLabel={admin.email}
      userName={admin.fullName ?? admin.email.split('@')[0] ?? ''}
      notificationBell={<NotificationBell userId={admin.id} />}
    >
      {children}
    </AdminShell>
  )
}
