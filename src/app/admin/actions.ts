'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/db/client'
import {
  submission,
  reviewDecision,
  auditLog,
  notification,
  adminProfile,
  certificate,
} from '@/db/schema'
import { generateCertificateNumber } from '@/lib/certificate-number'
import { CERTIFICATE_VALIDITY_DAYS, STORAGE_PATHS } from '@/lib/constants'
import { createServiceClient } from '@/lib/supabase/server'

// ─── Claim / Release ───────────────────────────────────────────────────

const idSchema = z.object({ submissionId: z.string().uuid() })

export async function claimAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const parsed = idSchema.parse({ submissionId: formData.get('submissionId') })

  // Atomic claim — only succeeds if the row is currently unassigned.
  const updated = await db
    .update(submission)
    .set({ assignedAdminId: admin.id, claimedAt: new Date(), status: 'assigned' })
    .where(
      and(
        eq(submission.id, parsed.submissionId),
        eq(submission.status, 'pending_admin_review'),
        isNull(submission.assignedAdminId),
      ),
    )
    .returning({ id: submission.id })

  if (updated.length === 0) {
    throw new Error('Already claimed by another CPA')
  }

  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'claim',
    subjectType: 'submission',
    subjectId: parsed.submissionId,
  })

  revalidatePath('/admin/queue')
  redirect(`/admin/submissions/${parsed.submissionId}`)
}

export async function releaseAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const parsed = idSchema.parse({ submissionId: formData.get('submissionId') })

  const updated = await db
    .update(submission)
    .set({ assignedAdminId: null, claimedAt: null, status: 'pending_admin_review' })
    .where(and(eq(submission.id, parsed.submissionId), eq(submission.assignedAdminId, admin.id)))
    .returning({ id: submission.id })

  if (updated.length === 0) throw new Error('Cannot release — not assigned to you')

  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'release',
    subjectType: 'submission',
    subjectId: parsed.submissionId,
  })

  revalidatePath('/admin/queue')
  revalidatePath(`/admin/submissions/${parsed.submissionId}`)
}

// ─── Decision ──────────────────────────────────────────────────────────

const decisionSchema = z.object({
  submissionId: z.string().uuid(),
  decision: z.enum(['approve', 'request_changes', 'reject']),
  notes: z.string().optional(),
})

export async function decisionAction(formData: FormData) {
  const admin = await requireAdmin()
  const parsed = decisionSchema.safeParse({
    submissionId: formData.get('submissionId'),
    decision: formData.get('decision'),
    notes: String(formData.get('notes') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  if (parsed.data.decision !== 'approve' && !parsed.data.notes?.trim()) {
    return { error: 'Notes are required when requesting changes or rejecting.' }
  }

  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, parsed.data.submissionId))
    .limit(1)
  if (!sub) return { error: 'Not found' }
  if (sub.assignedAdminId !== admin.id) return { error: 'Assign the submission to yourself first' }

  await db.insert(reviewDecision).values({
    submissionId: parsed.data.submissionId,
    adminId: admin.id,
    decision: parsed.data.decision,
    notes: parsed.data.notes,
  })

  const nextStatus =
    parsed.data.decision === 'approve'
      ? 'approved'
      : parsed.data.decision === 'reject'
      ? 'rejected'
      : 'changes_requested'

  await db
    .update(submission)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(submission.id, parsed.data.submissionId))

  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: `decision:${parsed.data.decision}`,
    subjectType: 'submission',
    subjectId: parsed.data.submissionId,
    diff: { notes: parsed.data.notes ?? null, status: nextStatus },
  })

  await db.insert(notification).values({
    userId: sub.customerId,
    type:
      parsed.data.decision === 'approve'
        ? 'approved'
        : parsed.data.decision === 'reject'
        ? 'rejected'
        : 'changes_requested',
    title:
      parsed.data.decision === 'approve'
        ? 'Approved — signature next'
        : parsed.data.decision === 'reject'
        ? 'Verification rejected'
        : 'Action needed on your submission',
    body: parsed.data.notes ?? null,
    relatedSubmissionId: parsed.data.submissionId,
  })

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`)
  revalidatePath('/admin/queue')
  return { error: null }
}

// ─── One-click Approve & Auto-Sign ─────────────────────────────────────
// Lets a CPA who has a saved profile signature approve + generate the
// certificate in a single action — no modal, no re-drawing.

const approveAndSignSchema = z.object({
  submissionId: z.string().uuid(),
  notes: z.string().optional(),
  certificationConfirmed: z.literal('true'),
})

export async function approveAndSignAction(formData: FormData) {
  const admin = await requireAdmin()

  const parsed = approveAndSignSchema.safeParse({
    submissionId: formData.get('submissionId'),
    notes: String(formData.get('notes') ?? ''),
    certificationConfirmed: formData.get('certificationConfirmed'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Verify assignment + existence of a saved signature
  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, parsed.data.submissionId))
    .limit(1)
  if (!sub) return { error: 'Not found' }
  if (sub.assignedAdminId !== admin.id)
    return { error: 'Claim the submission before one-click sign' }
  if (sub.status === 'letter_generated' || sub.status === 'rejected') {
    return { error: `Submission already ${sub.status}` }
  }

  const [profile] = await db
    .select()
    .from(adminProfile)
    .where(eq(adminProfile.userId, admin.id))
    .limit(1)
  if (!profile?.signatureImagePath) {
    return {
      error: 'Save a signature on your profile first, then try again.',
    }
  }

  // 1) Record the approval decision
  await db.insert(reviewDecision).values({
    submissionId: parsed.data.submissionId,
    adminId: admin.id,
    decision: 'approve',
    notes: parsed.data.notes || null,
  })
  await db
    .update(submission)
    .set({ status: 'approved', updatedAt: new Date() })
    .where(eq(submission.id, parsed.data.submissionId))
  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'decision:approve',
    subjectType: 'submission',
    subjectId: parsed.data.submissionId,
    diff: { notes: parsed.data.notes ?? null, status: 'approved', oneClick: true },
  })

  // 2) Pipe straight into signAndGenerateAction using the stored signature
  const fd = new FormData()
  fd.set('submissionId', parsed.data.submissionId)
  fd.set('signatureDataUrl', 'USE_PROFILE_SIGNATURE')
  fd.set('certificationConfirmed', 'true')
  const signResult = await signAndGenerateAction(fd)
  if (signResult.error) {
    // Approval already recorded; caller can see the error and manually sign.
    return {
      error: `Approved, but auto-sign failed: ${signResult.error}. Open the signature modal.`,
    }
  }

  return { error: null, certificateNumber: signResult.certificateNumber }
}

// ─── Revoke Certificate ────────────────────────────────────────────────

const revokeSchema = z.object({
  certificateId: z.string().uuid(),
  reason: z.string().min(5, 'Reason required (min 5 chars)'),
})

export async function revokeCertificateAction(formData: FormData) {
  const admin = await requireAdmin()
  const parsed = revokeSchema.safeParse({
    certificateId: formData.get('certificateId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const [cert] = await db
    .select()
    .from(certificate)
    .where(eq(certificate.id, parsed.data.certificateId))
    .limit(1)
  if (!cert) return { error: 'Certificate not found' }
  if (cert.revoked) return { error: 'Already revoked' }

  await db
    .update(certificate)
    .set({
      revoked: true,
      revokedAt: new Date(),
      revokedByAdminId: admin.id,
      revocationReason: parsed.data.reason,
    })
    .where(eq(certificate.id, parsed.data.certificateId))

  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'certificate:revoke',
    subjectType: 'certificate',
    subjectId: parsed.data.certificateId,
    diff: { reason: parsed.data.reason, certificateNumber: cert.certificateNumber },
  })

  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, cert.submissionId))
    .limit(1)
  if (sub) {
    await db.insert(notification).values({
      userId: sub.customerId,
      type: 'rejected',
      title: 'Certificate revoked',
      body: `Certificate ${cert.certificateNumber} has been revoked. Reason: ${parsed.data.reason}`,
      relatedSubmissionId: sub.id,
    })
  }

  revalidatePath(`/admin/submissions/${cert.submissionId}`)
  revalidatePath('/letter')
  revalidatePath(`/verify-public/${cert.certificateNumber}`)
  return { error: null }
}

// ─── Generate Letter + E-Sign ──────────────────────────────────────────

const signAndGenerateSchema = z.object({
  submissionId: z.string().uuid(),
  /**
   * Either a fresh base64 signature drawn in the modal,
   * or the sentinel `USE_PROFILE_SIGNATURE` to re-use the admin's saved one.
   */
  signatureDataUrl: z
    .string()
    .refine(
      (v) =>
        v === 'USE_PROFILE_SIGNATURE' ||
        v.startsWith('data:image/png;base64,'),
      { message: 'Signature required' },
    ),
  certificationConfirmed: z.literal('true'),
})

export async function signAndGenerateAction(formData: FormData) {
  const admin = await requireAdmin()

  const parsed = signAndGenerateSchema.safeParse({
    submissionId: formData.get('submissionId'),
    signatureDataUrl: formData.get('signatureDataUrl'),
    certificationConfirmed: formData.get('certificationConfirmed'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature submission' }
  }

  const [sub] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, parsed.data.submissionId))
    .limit(1)
  if (!sub) return { error: 'Not found' }
  if (sub.assignedAdminId !== admin.id) return { error: 'Not assigned to you' }
  if (sub.status !== 'approved') return { error: 'Submission must be approved first' }
  if (!sub.verificationPath) return { error: 'Verification path missing' }

  const [profile] = await db
    .select()
    .from(adminProfile)
    .where(eq(adminProfile.userId, admin.id))
    .limit(1)

  // Get signature bytes — either from the drawn pad or from the admin's stored profile signature
  const supabase = createServiceClient()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'

  const certNumber = generateCertificateNumber()
  let sigBytes: Buffer
  if (parsed.data.signatureDataUrl === 'USE_PROFILE_SIGNATURE') {
    if (!profile?.signatureImagePath) {
      return {
        error:
          'No saved signature on your profile. Draw one on /admin/profile or use the signature modal.',
      }
    }
    const { data: storedSig, error: downloadErr } = await supabase.storage
      .from(bucket)
      .download(profile.signatureImagePath)
    if (downloadErr || !storedSig) {
      return {
        error: `Could not load your saved signature: ${downloadErr?.message ?? 'unavailable'}`,
      }
    }
    sigBytes = Buffer.from(await storedSig.arrayBuffer())
  } else {
    sigBytes = Buffer.from(
      parsed.data.signatureDataUrl.replace(/^data:image\/png;base64,/, ''),
      'base64',
    )
  }
  const sigPath = STORAGE_PATHS.certificateSignature(parsed.data.submissionId, certNumber)

  const { error: sigErr } = await supabase.storage
    .from(bucket)
    .upload(sigPath, sigBytes, { contentType: 'image/png', upsert: false })
  if (sigErr) return { error: `Signature upload failed: ${sigErr.message}` }

  // Generate PDF + DOCX (stubs for now — Phase 5 wires pdf-lib).
  const pdfPath = STORAGE_PATHS.certificatePdf(parsed.data.submissionId, certNumber)
  const docxPath = STORAGE_PATHS.certificateDocx(parsed.data.submissionId, certNumber)

  const validThrough = new Date()
  const days =
    profile?.defaultValidityDays ?? CERTIFICATE_VALIDITY_DAYS[sub.verificationPath]
  validThrough.setUTCDate(validThrough.getUTCDate() + days)

  const issuedAt = new Date()

  try {
    const { buildLetterPdf } = await import('@/lib/letter-pdf')
    const pdfBytes = await buildLetterPdf({
      certificateNumber: certNumber,
      path: sub.verificationPath,
      issuedAt,
      validThrough,
      investorName: sub.investorName ?? '—',
      investorAddressLine1: sub.investorAddressLine1,
      investorAddressLine2: sub.investorAddressLine2,
      taxYearPrimary: sub.taxYearPrimary,
      taxYearSecondary: sub.taxYearSecondary,
      cpa: {
        name: admin.fullName ?? admin.email,
        license: profile?.cpaLicenseNo ?? '',
        title: profile?.title ?? 'CPA',
        firm: profile?.firmName ?? 'AG FINTAX, LLC',
        firmCity: profile?.firmCity ?? '',
        firmEmail: profile?.firmEmail ?? admin.email,
        jurisdiction: profile?.jurisdiction ?? '',
      },
      signaturePng: sigBytes,
    })

    const { error: pdfErr } = await supabase.storage
      .from(bucket)
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false })
    if (pdfErr) return { error: `PDF upload failed: ${pdfErr.message}` }
  } catch (err) {
    return { error: `Certificate PDF build failed: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Build DOCX from the AG-FinTax letter template (preserves logo + Word-native layout)
  try {
    const { buildCertificateDocx } = await import('@/lib/letter-docx')
    const docxBytes = buildCertificateDocx({
      certificateNumber: certNumber,
      path: sub.verificationPath,
      issuedAt,
      validThrough,
      investorName: sub.investorName ?? '—',
      investorAddressLine1: sub.investorAddressLine1,
      investorAddressLine2: sub.investorAddressLine2,
      taxYearPrimary: sub.taxYearPrimary,
      taxYearSecondary: sub.taxYearSecondary,
    })
    const { error: docxErr } = await supabase.storage
      .from(bucket)
      .upload(docxPath, docxBytes, {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: false,
      })
    if (docxErr) {
      console.warn('DOCX upload failed (PDF still issued):', docxErr.message)
    }
  } catch (err) {
    // DOCX is secondary — log and continue
    console.warn(
      'DOCX certificate build failed (PDF still issued):',
      err instanceof Error ? err.message : String(err),
    )
  }

  await db.insert(certificate).values({
    submissionId: parsed.data.submissionId,
    certificateNumber: certNumber,
    path: sub.verificationPath,
    pdfStoragePath: pdfPath,
    docxStoragePath: docxPath,
    signatureStoragePath: sigPath,
    validThrough,
    generatedByAdminId: admin.id,
    snapshot: {
      investorName: sub.investorName,
      filingStatus: sub.filingStatus,
      path: sub.verificationPath,
    },
  })

  await db
    .update(submission)
    .set({ status: 'letter_generated', updatedAt: new Date() })
    .where(eq(submission.id, parsed.data.submissionId))

  await db.insert(auditLog).values({
    actorId: admin.id,
    actorRole: 'admin',
    action: 'certificate:sign_and_generate',
    subjectType: 'submission',
    subjectId: parsed.data.submissionId,
    diff: { certificateNumber: certNumber, validThrough: validThrough.toISOString() },
  })

  await db.insert(notification).values({
    userId: sub.customerId,
    type: 'letter_ready',
    title: 'Your verification certificate is ready',
    body: `Certificate ${certNumber} · valid through ${validThrough.toISOString().split('T')[0]}`,
    relatedSubmissionId: parsed.data.submissionId,
  })

  // Suppress unused-warning for sql helper — imported for future use.
  void sql

  revalidatePath(`/admin/submissions/${parsed.data.submissionId}`)
  return { error: null, certificateNumber: certNumber }
}
