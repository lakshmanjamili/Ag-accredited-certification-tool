'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ email: z.string().email() })

export type ResetResult = { error: string } | { error: null }

export async function requestPasswordResetAction(
  _prev: ResetResult | null,
  formData: FormData,
): Promise<ResetResult> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Valid email required' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  })

  // Always return success to avoid leaking whether the email exists.
  if (error) {
    console.error('reset-password error', error.message)
  }
  return { error: null }
}
