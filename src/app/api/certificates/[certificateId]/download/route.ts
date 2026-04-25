import { NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db } from '@/db/client'
import { certificate, submission, auditLog } from '@/db/schema'
import { createServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ certificateId: string }>

export async function GET(request: Request, { params }: { params: Params }) {
  const user = await requireUser()
  const { certificateId } = await params
  const format = new URL(request.url).searchParams.get('format') === 'docx' ? 'docx' : 'pdf'

  const [cert] = await db
    .select()
    .from(certificate)
    .where(eq(certificate.id, certificateId))
    .limit(1)
  if (!cert) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (cert.revoked) return NextResponse.json({ error: 'revoked' }, { status: 410 })

  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, cert.submissionId))
    .limit(1)
  if (!sub) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const isOwner = sub.customerId === user.id
  const isAdmin = user.role === 'admin'
  if (!isOwner && !isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const storagePath = format === 'docx' ? cert.docxStoragePath : cert.pdfStoragePath
  if (!storagePath) {
    return NextResponse.json({ error: `${format.toUpperCase()} not available` }, { status: 404 })
  }

  const supabase = createServiceClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'
  const { data, error } = await supabase.storage.from(bucket).download(storagePath)
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'unavailable' }, { status: 500 })
  }

  const arrayBuffer = await data.arrayBuffer()

  await db
    .update(certificate)
    .set({
      downloadCount: sql`${certificate.downloadCount} + 1`,
      lastDownloadedAt: new Date(),
    })
    .where(eq(certificate.id, certificateId))

  await db.insert(auditLog).values({
    actorId: user.id,
    actorRole: user.role,
    action: `certificate:download:${format}`,
    subjectType: 'certificate',
    subjectId: certificateId,
  })

  const contentType =
    format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf'

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${cert.certificateNumber}.${format}"`,
      'X-Certificate-Number': cert.certificateNumber,
    },
  })
}
