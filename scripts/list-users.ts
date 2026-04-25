/**
 * List every auth user with their role and confirmation status.
 *
 * Usage:  npm run user:list
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const rows: { email: string; role: string; confirmed: string; created: string }[] = []
  let page = 1
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      const role = (u.app_metadata as { role?: string } | null)?.role ?? 'customer'
      rows.push({
        email: u.email ?? '(no email)',
        role,
        confirmed: u.email_confirmed_at ? 'yes' : 'no',
        created: u.created_at ?? '',
      })
    }
    if (data.users.length < 200) break
    page += 1
  }

  rows.sort((a, b) => a.email.localeCompare(b.email))

  const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n)
  console.info(pad('EMAIL', 44) + pad('ROLE', 10) + pad('CONFIRMED', 11) + 'CREATED')
  console.info('-'.repeat(90))
  for (const r of rows) {
    console.info(pad(r.email, 44) + pad(r.role, 10) + pad(r.confirmed, 11) + r.created.slice(0, 19))
  }
  console.info(`\n${rows.length} user(s)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
