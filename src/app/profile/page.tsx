import { requireUser } from '@/lib/auth'
import { AppHeader } from '@/components/shared/app-header'

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <>
      <AppHeader userId={user.id} userLabel={user.email} role="customer" />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-muted-foreground">Manage your personal information.</p>

        <div className="mt-10 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Email</div>
            <div className="mt-1 font-medium">{user.email}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Full name</div>
            <div className="mt-1 font-medium">{user.fullName ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Role</div>
            <div className="mt-1 font-medium capitalize">{user.role}</div>
          </div>
        </div>
      </main>
    </>
  )
}
