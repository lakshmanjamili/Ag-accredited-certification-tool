import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'
const EXPIRY_SECONDS = 60 * 15 // 15 min

/**
 * Generate short-lived signed URLs for the given storage paths. Uses the
 * service-role client — only call from server components / route handlers.
 */
export async function signStoragePaths(paths: string[]): Promise<Record<string, string | null>> {
  if (paths.length === 0) return {}
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, EXPIRY_SECONDS)
  if (error || !data) {
    console.error('createSignedUrls failed', error?.message)
    return Object.fromEntries(paths.map((p) => [p, null]))
  }
  const out: Record<string, string | null> = {}
  for (const item of data) out[item.path ?? ''] = item.signedUrl ?? null
  return out
}
