'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  fullName: z.string().min(2, 'Tell us your name'),
})

export type SignUpResult = { error: string; ok?: false } | { error: null; ok: true }

export async function signUpAction(
  _prev: SignUpResult | null,
  formData: FormData,
): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  // If email confirmation is ON (typical default), session will be null here
  // and the user needs to click the confirmation link. We render the success
  // state so they know to check their inbox.
  if (!data.session) return { error: null, ok: true }

  // If email confirmation is OFF, redirect straight to dashboard.
  redirect('/dashboard')
}
