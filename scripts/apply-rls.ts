/**
 * Applies supabase/rls.sql via the postgres-js driver.
 * Runs the whole file as a single multi-statement query.
 */

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('No DIRECT_DATABASE_URL / DATABASE_URL set')
  process.exit(1)
}

const sqlPath = path.resolve(process.cwd(), 'supabase/rls.sql')
const contents = fs.readFileSync(sqlPath, 'utf-8')

const sql = postgres(url, { prepare: false, max: 1 })

async function main() {
  console.info(`→ applying ${sqlPath}`)
  try {
    await sql.unsafe(contents)
    console.info('✅ RLS + trigger installed.')
  } catch (err) {
    console.error('❌ failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main()
