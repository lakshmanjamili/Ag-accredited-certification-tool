import { NextResponse } from 'next/server'
import { eq, and, lte, asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { job, document } from '@/db/schema'
import { extractDocument } from '@/lib/extraction'
import { hydrateSubmissionFromForm1040 } from '@/lib/hydrate-submission'
import { createServiceClient } from '@/lib/supabase/server'

const MAX_JOBS_PER_TICK = 5
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const due = await db
    .select()
    .from(job)
    .where(and(eq(job.status, 'pending'), lte(job.scheduledAt, new Date())))
    .orderBy(asc(job.scheduledAt))
    .limit(MAX_JOBS_PER_TICK)

  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const j of due) {
    await db
      .update(job)
      .set({ status: 'in_progress', startedAt: new Date(), attempts: j.attempts + 1 })
      .where(eq(job.id, j.id))

    try {
      if (j.kind === 'extract') {
        await runExtractJob(j.payload as { documentId: string })
      }
      await db
        .update(job)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(job.id, j.id))
      results.push({ id: j.id, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const next = j.attempts + 1 >= j.maxAttempts ? 'failed' : 'pending'
      await db
        .update(job)
        .set({
          status: next,
          lastError: msg,
          scheduledAt: next === 'pending' ? new Date(Date.now() + 60_000) : j.scheduledAt,
        })
        .where(eq(job.id, j.id))
      results.push({ id: j.id, ok: false, error: msg })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

export async function GET(request: Request) {
  // Allow Vercel Cron GET pings.
  return POST(request)
}

async function runExtractJob(payload: { documentId: string }) {
  const [doc] = await db
    .select()
    .from(document)
    .where(eq(document.id, payload.documentId))
    .limit(1)
  if (!doc) throw new Error('Document not found')

  await db
    .update(document)
    .set({ extractionStatus: 'in_progress' })
    .where(eq(document.id, doc.id))

  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(doc.storagePath)
  if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? 'no data'}`)

  const buffer = await data.arrayBuffer()
  const result = await extractDocument(doc.type, buffer)

  if (result.error) {
    await db
      .update(document)
      .set({
        extractionStatus: 'failed',
        errorMessage: result.error,
        extractedAt: new Date(),
      })
      .where(eq(document.id, doc.id))
    return
  }

  await db
    .update(document)
    .set({
      extractionStatus: 'done',
      azureModelId: result.modelUsed ?? null,
      confidence: result.confidence != null ? String(result.confidence) : null,
      rawExtraction: {
        ...result.keyValues,
        __displayFields: result.displayFields,
        __docType: result.docType,
        __fallback: result.fallbackUsed,
        __textPreview: result.rawTextPreview,
        __pageCount: result.pageCount,
      },
      extractedAt: new Date(),
    })
    .where(eq(document.id, doc.id))

  // Propagate 1040 fields (name, address, tax years, filing status) to the
  // submission so the letter DOCX template has them on approval.
  if (doc.type === 'form_1040') {
    try {
      await hydrateSubmissionFromForm1040(doc.submissionId)
    } catch (err) {
      console.warn(
        '[hydrate-submission] failed (non-fatal):',
        err instanceof Error ? err.message : err,
      )
    }
  }
}
