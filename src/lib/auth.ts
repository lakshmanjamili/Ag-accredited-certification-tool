import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/constants'

export type AuthUser = {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  raw: User
}

function toAuthUser(user: User): AuthUser {
  const role = ((user.app_metadata as { role?: string } | null)?.role ?? 'customer') as UserRole
  const fullName =
    (user.user_metadata as { full_name?: string } | null)?.full_name ?? null
  return { id: user.id, email: user.email ?? '', fullName, role, raw: user }
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user ? toAuthUser(data.user) : null
})

export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) redirect('/sign-in')
  return user
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/dashboard')
  return user
}
