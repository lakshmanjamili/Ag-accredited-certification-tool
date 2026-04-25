'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { db } from '@/db/client'
import { userProfile } from '@/db/schema'
import { createServiceClient } from '@/lib/supabase/server'

const schema = z.object({
  fullName: z.string().min(1, 'Full name required').max(200),
  phone: z.string().max(40).optional(),
})

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser()

  const parsed = schema.safeParse({
    fullName: formData.get('fullName'),
    phone: (formData.get('phone') as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  // Update profile table
  await db
    .update(userProfile)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      updatedAt: new Date(),
    })
    .where(eq(userProfile.id, user.id))

  // Also sync Supabase user metadata so the trigger stays consistent
  const admin = createServiceClient()
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: parsed.data.fullName },
  })

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  return { error: null }
}
