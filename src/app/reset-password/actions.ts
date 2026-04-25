'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ password: z.string().min(8, 'At least 8 characters') })

export type UpdatePasswordResult = { error: string } | { error: null }

export async function updatePasswordAction(
  _prev: UpdatePasswordResult | null,
  formData: FormData,
): Promise<UpdatePasswordResult> {
  const parsed = schema.safeParse({ password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid password' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }

  redirect('/dashboard')
}
