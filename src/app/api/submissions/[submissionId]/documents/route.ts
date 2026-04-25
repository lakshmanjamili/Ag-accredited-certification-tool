/**
 * Document upload endpoint — runs Azure Document Intelligence extraction
 * INLINE as soon as the file is recorded, so the customer (and admin) see
 * extracted fields the moment the upload response lands. No job queue, no
 * cron, no fire-and-forget HTTP kick.
 *
 * Flow:
 *   1. Validate + record the document row (status: pending)
 *   2. Download the file from Supabase storage
 *   3. Route to the right Azure DI model (form_1040 → 1040, w2 → w2, etc.)
 *   4. Persist the normalized extraction on the document row (status: done)
 *   5. If it's a Form 1040, hydrate the submission with name/address/years
 *   6. Return { ok, documentId, extraction: { status, confidence, fields[] } }
 *
 * Extraction typically takes 5–12s. We accept the latency for reliability
 * during the demo — a spinner on the client is preferable to a silent queue.
 */

import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db } from '@/db/client'
import { submission, document } from '@/db/schema'
import { uploadDocumentSchema } from '@/lib/zod/verify'
import { extractDocument } from '@/lib/extraction'
import { hydrateSubmissionFromForm1040 } from '@/lib/hydrate-submission'
import { createServiceClient } from '@/lib/supabase/server'

// Azure DI can run 5–15s on a multi-page 1040 — give the route enough budget
// on Vercel so the extraction finishes before the response is sent.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Params = Promise<{ submissionId: string }>

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'

export async function POST(request: Request, { params }: { params: Params }) {
  const user = await requireUser()
  const { submissionId } = await params
  const body = await request.json().catch(() => null)

  const parsed = uploadDocumentSchema.safeParse({ ...body, submissionId })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, submissionId))
    .limit(1)
  if (!sub || sub.customerId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (sub.status !== 'draft' && sub.status !== 'changes_requested') {
    return NextResponse.json({ error: 'Submission locked' }, { status: 409 })
  }

  // 1. Record the document row
  const [row] = await db
    .insert(document)
    .values({
      submissionId,
      type: parsed.data.type,
      storagePath: parsed.data.storagePath,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      extractionStatus: 'in_progress',
    })
    .returning({ id: document.id })

  // 2. Pull the bytes and run Azure DI inline
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(parsed.data.storagePath)
    if (error || !data) {
      throw new Error(
        `Storage download failed: ${error?.message ?? 'no data returned'}`,
      )
    }
    const buffer = await data.arrayBuffer()

    console.info(
      `[extract] submission=${submissionId} doc=${row.id} type=${parsed.data.type} size=${buffer.byteLength}`,
    )
    const started = Date.now()
    const result = await extractDocument(parsed.data.type, buffer)
    const ms = Date.now() - started
    console.info(
      `[extract] done doc=${row.id} model=${result.modelUsed ?? '—'} fallback=${result.fallbackUsed} confidence=${result.confidence ?? '—'} fields=${result.displayFields.length} in ${ms}ms`,
    )

    // 3. Persist the extraction.
    // A hard failure is only when there's an error AND no fallback ran —
    // fallback-used means layout OCR still produced text/fields, so we
    // mark as done and surface a notice instead of "failed".
    const hardFailed = !!result.error && !result.fallbackUsed
    if (hardFailed) {
      await db
        .update(document)
        .set({
          extractionStatus: 'failed',
          errorMessage: result.error ?? null,
          azureModelId: result.modelUsed ?? null,
          extractedAt: new Date(),
        })
        .where(eq(document.id, row.id))

      return NextResponse.json({
        ok: true,
        documentId: row.id,
        extraction: { status: 'failed', error: result.error },
      })
    }

    await db
      .update(document)
      .set({
        extractionStatus: 'done',
        azureModelId: result.modelUsed ?? null,
        confidence:
          result.confidence != null ? String(result.confidence) : null,
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
      .where(eq(document.id, row.id))

    // 4. Propagate 1040 fields (name, address, years, filing status) onto the
    //    submission so the letter template has them on approval.
    if (parsed.data.type === 'form_1040') {
      try {
        await hydrateSubmissionFromForm1040(submissionId)
      } catch (err) {
        console.warn(
          '[hydrate-submission] failed (non-fatal):',
          err instanceof Error ? err.message : err,
        )
      }
    }

    return NextResponse.json({
      ok: true,
      documentId: row.id,
      extraction: {
        status: 'done',
        confidence: result.confidence,
        modelUsed: result.modelUsed,
        fallbackUsed: result.fallbackUsed,
        fallbackReason: result.fallbackUsed ? result.error ?? null : null,
        fields: result.displayFields.map((f) => ({
          label: f.label,
          value: f.value,
          confidence: f.confidence,
          highlight: f.highlight,
        })),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[extract] doc=${row.id} failed:`, msg)

    await db
      .update(document)
      .set({
        extractionStatus: 'failed',
        errorMessage: msg.slice(0, 500),
        extractedAt: new Date(),
      })
      .where(eq(document.id, row.id))

    // Upload itself succeeded — return 200 with the failure so the uploader
    // can show an inline error next to the doc card.
    return NextResponse.json({
      ok: true,
      documentId: row.id,
      extraction: { status: 'failed', error: msg },
    })
  }
}
