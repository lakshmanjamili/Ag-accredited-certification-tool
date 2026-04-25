import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
  // Only manage the public schema. Supabase owns `auth`, `storage`, `graphql`, etc.
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
})
