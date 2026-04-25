/**
 * Seed demo users and admin profiles.
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY must be set (bypasses RLS)
 *   - Schema must be pushed first: `npm run db:push`
 *   - RLS SQL already applied from supabase/rls.sql
 *
 * Run: `npx tsx -r dotenv/config scripts/seed.ts dotenv_config_path=.env.local`
 * or:  `npx dotenv -e .env.local -- tsx scripts/seed.ts`
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL

if (!SUPABASE_URL || !SERVICE_KEY || !DATABASE_URL) {
  console.error('Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const pg = postgres(DATABASE_URL, { prepare: false })
const db = drizzle(pg, { schema })

type SeedUser = {
  email: string
  password: string
  fullName: string
  role: 'customer' | 'admin'
  adminProfile?: {
    cpaLicenseNo: string
    title: string
    firmName: string
    firmCity: string
    firmEmail: string
    jurisdiction: string
    phone: string
    typedSignatureBlock: string
  }
}

const SEEDS: SeedUser[] = [
  {
    email: 'demo.customer@agfintax.dev',
    password: 'Demo12345!',
    fullName: 'Demo Customer',
    role: 'customer',
  },
  {
    email: 'anil.cpa@agfintax.dev',
    password: 'Demo12345!',
    fullName: 'Anil Grandhi',
    role: 'admin',
    adminProfile: {
      cpaLicenseNo: 'CA-123456',
      title: 'Managing Partner · CPA',
      firmName: 'AgFinTax Advisors, LLC',
      firmCity: 'Austin, TX',
      firmEmail: 'anil@agfintax.com',
      jurisdiction: 'California, USA',
      phone: '+1 (512) 555-0180',
      typedSignatureBlock: 'Anil Grandhi, CPA\nManaging Partner\nAgFinTax Advisors, LLC',
    },
  },
  {
    email: 'review.cpa@agfintax.dev',
    password: 'Demo12345!',
    fullName: 'Review CPA',
    role: 'admin',
    adminProfile: {
      cpaLicenseNo: 'CA-654321',
      title: 'Senior Reviewer · CPA',
      firmName: 'AgFinTax Advisors, LLC',
      firmCity: 'Austin, TX',
      firmEmail: 'review@agfintax.com',
      jurisdiction: 'Texas, USA',
      phone: '+1 (512) 555-0181',
      typedSignatureBlock: 'Review CPA\nSenior Reviewer\nAgFinTax Advisors, LLC',
    },
  },
]

async function findUserByEmail(email: string) {
  // paginate a few pages in case the project grows
  let page = 1
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === email)
    if (hit) return hit
    if (data.users.length < 200) return null
    page += 1
  }
  return null
}

async function upsertUser(seed: SeedUser) {
  const existing = await findUserByEmail(seed.email)
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: seed.password,
      email_confirm: true,
      user_metadata: { full_name: seed.fullName },
      app_metadata: { role: seed.role },
    })
    if (error) throw error
    return data.user
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: seed.email,
    password: seed.password,
    email_confirm: true,
    user_metadata: { full_name: seed.fullName },
    app_metadata: { role: seed.role },
  })
  if (error) throw error
  return data.user
}

async function main() {
  for (const seed of SEEDS) {
    console.info(`→ ${seed.email}`)
    const user = await upsertUser(seed)
    if (!user) throw new Error(`Failed to upsert ${seed.email}`)

    // The auth trigger creates user_profile automatically; if the trigger
    // isn't installed yet we insert manually as a fallback.
    await db
      .insert(schema.userProfile)
      .values({
        id: user.id,
        email: user.email ?? seed.email,
        fullName: seed.fullName,
        role: seed.role,
      })
      .onConflictDoUpdate({
        target: schema.userProfile.id,
        set: { email: user.email ?? seed.email, fullName: seed.fullName, role: seed.role },
      })

    if (seed.role === 'admin' && seed.adminProfile) {
      const existing = await db
        .select()
        .from(schema.adminProfile)
        .where(eq(schema.adminProfile.userId, user.id))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(schema.adminProfile).values({ userId: user.id, ...seed.adminProfile })
      } else {
        await db
          .update(schema.adminProfile)
          .set(seed.adminProfile)
          .where(eq(schema.adminProfile.userId, user.id))
      }
    }
  }
  console.info('Seed complete.')
  await pg.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
