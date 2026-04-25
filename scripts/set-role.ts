/**
 * Set a user's role in Supabase auth.app_metadata.
 * The on_auth_user_created trigger auto-syncs public.user_profile.role.
 *
 * Usage:
 *   npm run user:role -- <email> <customer|admin>
 *
 * Examples:
 *   npm run user:role -- lakshmanjamili@gmail.com customer
 *   npm run user:role -- anil.cpa@agfintax.dev admin
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const [, , email, role] = process.argv

if (!email || !role || !['customer', 'admin'].includes(role)) {
  console.error('Usage: npm run user:role -- <email> <customer|admin>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUser(emailToFind: string) {
  let page = 1
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === emailToFind.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
  }
  return null
}

async function main() {
  const user = await findUser(email)

  if (!user) {
    console.error(
      `❌ No user with email ${email}. They need to sign up at /sign-up first — once they do, re-run this command.`,
    )
    process.exit(1)
  }

  const current = (user.app_metadata as { role?: string } | null)?.role ?? 'customer'
  if (current === role) {
    console.info(`✓ ${email} is already ${role}. Nothing to do.`)
    return
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata ?? {}), role },
  })
  if (error) {
    console.error('❌ failed:', error.message)
    process.exit(1)
  }

  console.info(`✅ ${email}: ${current} → ${role}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
