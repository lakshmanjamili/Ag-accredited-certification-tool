'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import { adminProfile } from '@/db/schema'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  cpaLicenseNo: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  firmName: z.string().max(200).optional(),
  firmCity: z.string().max(200).optional(),
  firmEmail: z.string().email().optional().or(z.literal('')),
  jurisdiction: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  typedSignatureBlock: z.string().max(1000).optional(),
  defaultValidityDays: z
    .string()
    .optional()
    .transform((s) => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().max(730).optional()),
})

export async function saveAdminProfileAction(formData: FormData) {
  const admin = await requireAdmin()

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const vals = {
    cpaLicenseNo: parsed.data.cpaLicenseNo ?? null,
    title: parsed.data.title ?? 'CPA',
    firmName: parsed.data.firmName ?? null,
    firmCity: parsed.data.firmCity ?? null,
    firmEmail: parsed.data.firmEmail || null,
    jurisdiction: parsed.data.jurisdiction ?? null,
    phone: parsed.data.phone ?? null,
    typedSignatureBlock: parsed.data.typedSignatureBlock ?? null,
    defaultValidityDays: parsed.data.defaultValidityDays ?? null,
  }

  await db
    .insert(adminProfile)
    .values({ userId: admin.id, ...vals })
    .onConflictDoUpdate({
      target: adminProfile.userId,
      set: { ...vals, updatedAt: new Date() },
    })

  revalidatePath('/admin/profile')
  return { error: null }
}

// ─── Signature storage ─────────────────────────────────────────────────

const signatureSchema = z.object({
  signatureDataUrl: z.string().startsWith('data:image/png;base64,'),
})

export async function saveAdminSignatureAction(formData: FormData) {
  const admin = await requireAdmin()

  const parsed = signatureSchema.safeParse({
    signatureDataUrl: formData.get('signatureDataUrl'),
  })
  if (!parsed.success) return { error: 'Signature required' }

  const supabase = createServiceClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'
  const path = `signatures/${admin.id}/profile-${Date.now()}.png`
  const bytes = Buffer.from(
    parsed.data.signatureDataUrl.replace(/^data:image\/png;base64,/, ''),
    'base64',
  )

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: 'image/png', upsert: false })
  if (upErr) return { error: `Signature upload failed: ${upErr.message}` }

  await db
    .update(adminProfile)
    .set({ signatureImagePath: path, updatedAt: new Date() })
    .where(eq(adminProfile.userId, admin.id))

  revalidatePath('/admin/profile')
  revalidatePath('/admin/submissions')
  return { error: null, path }
}

export async function clearAdminSignatureAction() {
  const admin = await requireAdmin()
  await db
    .update(adminProfile)
    .set({ signatureImagePath: null, updatedAt: new Date() })
    .where(eq(adminProfile.userId, admin.id))
  revalidatePath('/admin/profile')
  revalidatePath('/admin/submissions')
  return { error: null }
}
