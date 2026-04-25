/**
 * Create (or update) a user with a set role + password. Idempotent.
 * If the user already exists, updates password and role to match.
 *
 * Usage:  npm run user:create -- <email> <password> <customer|admin>
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const [, , email, password, role] = process.argv
if (!email || !password || !role || !['customer', 'admin'].includes(role)) {
  console.error('Usage: npm run user:create -- <email> <password> <customer|admin>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url || !srvKey || !dbUrl) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.')
  process.exit(1)
}

const admin = createClient(url, srvKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const pg = postgres(dbUrl, { prepare: false })
const db = drizzle(pg, { schema })

async function findUser(emailToFind: string) {
  let page = 1
  while (page <= 20) {
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
  const existing = await findUser(email)
  let user
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata ?? {}), role },
    })
    if (error) throw error
    user = data.user
    console.info(`✏️  updated ${email}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    })
    if (error) throw error
    user = data.user
    console.info(`➕ created ${email}`)
  }

  // If admin, make sure an admin_profile row exists (seed with sensible defaults).
  if (role === 'admin' && user) {
    const [prof] = await db
      .select()
      .from(schema.adminProfile)
      .where(eq(schema.adminProfile.userId, user.id))
      .limit(1)

    if (!prof) {
      await db.insert(schema.adminProfile).values({
        userId: user.id,
        title: 'CPA',
        firmName: 'AgFinTax Advisors, LLC',
        firmCity: 'Austin, TX',
        firmEmail: email,
        jurisdiction: 'USA',
      })
      console.info(`   → created admin_profile`)
    }
  }

  console.info(`✅ ${email} · role=${role} · can sign in with password`)
  await pg.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
