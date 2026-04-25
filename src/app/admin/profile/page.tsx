import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import { adminProfile } from '@/db/schema'
import { AdminProfileForm } from './admin-profile-form'

export default async function AdminProfilePage() {
  const admin = await requireAdmin()
  const [profile] = await db
    .select()
    .from(adminProfile)
    .where(eq(adminProfile.userId, admin.id))
    .limit(1)

  return (
    <>
            <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">CPA profile</h1>
        <p className="mt-2 text-muted-foreground">
          Used to auto-populate the certificate when you sign off on a verification.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          <AdminProfileForm
            initial={{
              cpaLicenseNo: profile?.cpaLicenseNo ?? '',
              title: profile?.title ?? 'CPA',
              firmName: profile?.firmName ?? '',
              firmCity: profile?.firmCity ?? '',
              firmEmail: profile?.firmEmail ?? '',
              jurisdiction: profile?.jurisdiction ?? '',
              phone: profile?.phone ?? '',
              typedSignatureBlock: profile?.typedSignatureBlock ?? '',
              defaultValidityDays: profile?.defaultValidityDays ?? null,
            }}
          />
        </div>
      </main>
    </>
  )
}
