import 'dotenv/config'
import postgres from 'postgres'

async function tryConnect(label: string, url: string) {
  const redacted = url.replace(/:[^:@]+@/, ':****@')
  console.info(`\n[${label}] ${redacted}`)
  const sql = postgres(url, { prepare: false, connect_timeout: 8, max: 1 })
  try {
    const [row] = await sql`select current_user as usr, now() as ts`
    console.info(`  ✅ ${JSON.stringify(row)}`)
    return true
  } catch (err) {
    console.error(`  ❌ ${err instanceof Error ? err.message : err}`)
    return false
  } finally {
    await sql.end({ timeout: 2 })
  }
}

async function main() {
  const direct = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
  if (!direct) {
    console.error('No DIRECT_DATABASE_URL / DATABASE_URL set')
    process.exit(1)
  }

  // Extract password + ref from the existing pooler URL
  const match = direct.match(/postgres\.([^:]+):([^@]+)@/)
  if (!match) {
    console.error('Could not parse existing URL')
    process.exit(1)
  }
  const [, ref, pw] = match

  const candidates: Array<[string, string]> = [
    ['pooler us-east-1 (5432)', direct],
    ['direct IPv6 (db.xxx.supabase.co)', `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`],
    ['pooler us-east-2', `postgresql://postgres.${ref}:${pw}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`],
    ['pooler us-west-1', `postgresql://postgres.${ref}:${pw}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`],
    ['pooler eu-central-1', `postgresql://postgres.${ref}:${pw}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`],
  ]

  for (const [label, url] of candidates) {
    const ok = await tryConnect(label, url)
    if (ok) {
      console.info(`\n🎯 THIS WORKS. Put this URL in .env.local.`)
      console.info(`    ${url.replace(/:[^:@]+@/, ':YOUR_PW@')}`)
      break
    }
  }
}

main()
