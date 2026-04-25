'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import { userProfile, adminProfile, auditLog } from '@/db/schema'

function admin() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// ─── Invite ────────────────────────────────────────────────────────────
const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1, 'Name required').max(200),
  role: z.enum(['customer', 'admin']),
})

export async function inviteUserAction(formData: FormData) {
  const me = await requireAdmin()

  const parsed = inviteSchema.safeParse({
    email: (formData.get('email') as string)?.toLowerCase().trim(),
    fullName: (formData.get('fullName') as string)?.trim(),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const sb = admin()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await sb.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
    redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(
      parsed.data.role === 'admin' ? '/admin/profile' : '/dashboard',
    )}`,
  })

  if (error) {
    // Fallback: user may already exist → flip their role instead
    if (error.message.toLowerCase().includes('already') && parsed.data.role) {
      const found = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
      const existing = found.data.users.find(
        (u) => u.email?.toLowerCase() === parsed.data.email,
      )
      if (existing) {
        await sb.auth.admin.updateUserById(existing.id, {
          app_metadata: { ...(existing.app_metadata ?? {}), role: parsed.data.role },
        })
        revalidatePath('/admin/users')
        return { error: null, existed: true }
      }
    }
    return { error: error.message }
  }

  const user = data.user
  if (!user) return { error: 'User creation did not return a user object' }

  // Set the app role so the trigger syncs user_profile.role on next update
  const { error: metaErr } = await sb.auth.admin.updateUserById(user.id, {
    app_metadata: { role: parsed.data.role },
  })
  if (metaErr) return { error: `User invited but role not set: ${metaErr.message}` }

  // Create admin_profile stub for new admins (safe to re-run)
  if (parsed.data.role === 'admin') {
    await db
      .insert(adminProfile)
      .values({
        userId: user.id,
        title: 'CPA',
        firmEmail: parsed.data.email,
      })
      .onConflictDoNothing()
  }

  await db.insert(auditLog).values({
    actorId: me.id,
    actorRole: 'admin',
    action: 'user:invite',
    subjectType: 'user',
    subjectId: user.id,
    diff: { email: parsed.data.email, role: parsed.data.role },
  })

  revalidatePath('/admin/users')
  return { error: null, userId: user.id, existed: false }
}

// ─── Promote / demote ──────────────────────────────────────────────────
const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['customer', 'admin']),
})

export async function changeRoleAction(formData: FormData) {
  const me = await requireAdmin()
  const parsed = roleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  })
  if (!parsed.success) return { error: 'Invalid input' }
  if (parsed.data.userId === me.id) return { error: "You can't change your own role" }

  const sb = admin()
  const { data: target, error: fetchErr } = await sb.auth.admin.getUserById(parsed.data.userId)
  if (fetchErr || !target?.user) return { error: 'User not found' }

  const { error } = await sb.auth.admin.updateUserById(parsed.data.userId, {
    app_metadata: { ...(target.user.app_metadata ?? {}), role: parsed.data.role },
  })
  if (error) return { error: error.message }

  // For new admins, ensure there's a profile row
  if (parsed.data.role === 'admin') {
    await db
      .insert(adminProfile)
      .values({
        userId: parsed.data.userId,
        title: 'CPA',
        firmEmail: target.user.email ?? null,
      })
      .onConflictDoNothing()
  }

  await db.insert(auditLog).values({
    actorId: me.id,
    actorRole: 'admin',
    action: `user:set_role:${parsed.data.role}`,
    subjectType: 'user',
    subjectId: parsed.data.userId,
    diff: { previousRole: target.user.app_metadata?.role ?? 'customer' },
  })

  revalidatePath('/admin/users')
  return { error: null }
}

// ─── Resend invite / magic link ────────────────────────────────────────
export async function resendInviteAction(formData: FormData) {
  const me = await requireAdmin()
  const email = String(formData.get('email') ?? '').toLowerCase().trim()
  if (!email) return { error: 'Email required' }

  const sb = admin()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  // Supabase has no "resend invite" endpoint — use the magic-link flow
  const { error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback?next=/dashboard` },
  })
  if (error) return { error: error.message }

  await db.insert(auditLog).values({
    actorId: me.id,
    actorRole: 'admin',
    action: 'user:resend_invite',
    subjectType: 'user',
    diff: { email },
  })
  return { error: null }
}

// ─── Deactivate user ───────────────────────────────────────────────────
export async function deactivateUserAction(formData: FormData) {
  const me = await requireAdmin()
  const userId = String(formData.get('userId') ?? '')
  if (!userId) return { error: 'User id required' }
  if (userId === me.id) return { error: "You can't deactivate yourself" }

  const sb = admin()
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
  if (error) return { error: error.message }

  // Also mark admin_profile inactive if applicable
  await db
    .update(adminProfile)
    .set({ active: false })
    .where(eq(adminProfile.userId, userId))

  await db.insert(auditLog).values({
    actorId: me.id,
    actorRole: 'admin',
    action: 'user:deactivate',
    subjectType: 'user',
    subjectId: userId,
  })

  revalidatePath('/admin/users')
  return { error: null }
}
