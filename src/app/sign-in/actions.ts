'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password required'),
  next: z.string().optional(),
})

export type SignInResult = { error: string } | { error: null }

export async function signInAction(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) return { error: error.message }

  const role = (data.user?.app_metadata as { role?: string } | null)?.role
  const dest = parsed.data.next || (role === 'admin' ? '/admin' : '/dashboard')
  redirect(dest)
}

const magicLinkSchema = z.object({ email: z.string().email() })

export async function sendMagicLinkAction(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return { error: 'Valid email required' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })
  if (error) return { error: error.message }
  return { error: null }
}
