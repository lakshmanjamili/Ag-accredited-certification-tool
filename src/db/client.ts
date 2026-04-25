import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

declare global {
  var __pg: ReturnType<typeof postgres> | undefined
}

const connectionString =
  process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL ?? ''

const client = global.__pg ?? postgres(connectionString, { prepare: false, max: 10 })
if (process.env.NODE_ENV !== 'production') global.__pg = client

export const db = drizzle(client)
export { client as pg }
