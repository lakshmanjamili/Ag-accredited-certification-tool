'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { requireUser } from '@/lib/auth'
import { db } from '@/db/client'
import { submission, primaryResidenceInfo } from '@/db/schema'
import {
  createSubmissionSchema,
  filingStatusSchema,
  verificationPathSchema,
  primaryResidenceSchema,
  submitForReviewSchema,
} from '@/lib/zod/verify'

export async function createSubmissionAction(formData: FormData): Promise<void> {
  const user = await requireUser()

  const parsed = createSubmissionSchema.safeParse({
    verificationPath: formData.get('verificationPath'),
    filingStatus: formData.get('filingStatus') || undefined,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')
  }

  // Reuse any draft/changes_requested submission for this customer + path.
  const [existing] = await db
    .select()
    .from(submission)
    .where(
      and(
        eq(submission.customerId, user.id),
        eq(submission.verificationPath, parsed.data.verificationPath),
      ),
    )
    .limit(1)

  let id: string
  if (existing && (existing.status === 'draft' || existing.status === 'changes_requested')) {
    await db
      .update(submission)
      .set({
        filingStatus: parsed.data.filingStatus ?? existing.filingStatus,
        updatedAt: new Date(),
      })
      .where(eq(submission.id, existing.id))
    id = existing.id
  } else {
    const [row] = await db
      .insert(submission)
      .values({
        customerId: user.id,
        status: 'draft',
        verificationPath: parsed.data.verificationPath,
        filingStatus: parsed.data.filingStatus,
        investorName: user.fullName,
      })
      .returning({ id: submission.id })
    id = row.id
  }

  revalidatePath('/dashboard')
  redirect(`/verify/${id}`)
}

export async function updateSubmissionPathAction(formData: FormData) {
  const user = await requireUser()
  const submissionId = String(formData.get('submissionId') ?? '')
  const path = verificationPathSchema.parse(formData.get('verificationPath'))
  const filing = filingStatusSchema.optional().parse(formData.get('filingStatus') || undefined)

  await db
    .update(submission)
    .set({ verificationPath: path, filingStatus: filing, updatedAt: new Date() })
    .where(and(eq(submission.id, submissionId), eq(submission.customerId, user.id)))

  revalidatePath(`/verify/${submissionId}`)
}

export async function savePrimaryResidenceAction(formData: FormData) {
  const user = await requireUser()

  const parsed = primaryResidenceSchema.safeParse({
    submissionId: formData.get('submissionId'),
    ownsResidence: formData.get('ownsResidence') === 'true',
    fmvCents: formData.get('fmvCents') ? Number(formData.get('fmvCents')) : null,
    mortgageCents: formData.get('mortgageCents')
      ? Number(formData.get('mortgageCents'))
      : null,
    mortgageChanged60d: formData.get('mortgageChanged60d') === 'true',
    changeDescription: String(formData.get('changeDescription') ?? '') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Verify ownership.
  const [row] = await db
    .select({ customerId: submission.customerId })
    .from(submission)
    .where(eq(submission.id, parsed.data.submissionId))
    .limit(1)
  if (!row || row.customerId !== user.id) return { error: 'Not found' }

  await db
    .insert(primaryResidenceInfo)
    .values({
      submissionId: parsed.data.submissionId,
      ownsResidence: parsed.data.ownsResidence,
      fmvCents: parsed.data.fmvCents,
      mortgageCents: parsed.data.mortgageCents,
      mortgageChanged60d: parsed.data.mortgageChanged60d,
      changeDescription: parsed.data.changeDescription,
    })
    .onConflictDoUpdate({
      target: primaryResidenceInfo.submissionId,
      set: {
        ownsResidence: parsed.data.ownsResidence,
        fmvCents: parsed.data.fmvCents,
        mortgageCents: parsed.data.mortgageCents,
        mortgageChanged60d: parsed.data.mortgageChanged60d,
        changeDescription: parsed.data.changeDescription,
        updatedAt: new Date(),
      },
    })

  revalidatePath(`/verify/${parsed.data.submissionId}`)
  return { error: null }
}

export async function submitForReviewAction(formData: FormData) {
  const user = await requireUser()

  const parsed = submitForReviewSchema.safeParse({
    submissionId: formData.get('submissionId'),
    attested: formData.get('attested') === 'true',
  })
  if (!parsed.success) {
    return { error: 'You must attest before submitting.' }
  }

  const [row] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, parsed.data.submissionId))
    .limit(1)
  if (!row || row.customerId !== user.id) return { error: 'Not found' }
  if (row.status !== 'draft' && row.status !== 'changes_requested') {
    return { error: `Submission already ${row.status}` }
  }

  await db
    .update(submission)
    .set({
      status: 'pending_admin_review',
      submittedAt: new Date(),
      customerAttestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submission.id, parsed.data.submissionId))

  revalidatePath('/dashboard')
  revalidatePath(`/verify/${parsed.data.submissionId}`)
  return { error: null }
}
