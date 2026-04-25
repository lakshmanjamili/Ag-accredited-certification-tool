'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { submitForReviewAction } from '@/app/verify/actions'
import { toast } from 'sonner'

export function SubmitPanel({
  submissionId,
  status,
  ready,
  completion,
}: {
  submissionId: string
  status: string
  ready: boolean
  completion: { filled: number; total: number }
}) {
  const [attested, setAttested] = useState(false)
  const [pending, startTransition] = useTransition()

  // Approval done by CPA — done state
  if (status === 'letter_generated' || status === 'approved') {
    return (
      <div className="rounded-2xl bg-navy-gradient p-6 text-white shadow-ghost">
        <ShieldCheck className="mb-3 h-6 w-6 text-secondary" />
        <h3 className="font-serif text-xl italic">Approved.</h3>
        <p className="mt-1 text-sm text-white/70">
          Your certificate is ready. Open the <strong className="text-white">Vault</strong> to
          download it.
        </p>
      </div>
    )
  }

  // Locked states
  if (status === 'pending_admin_review' || status === 'assigned' || status === 'in_review') {
    return (
      <div className="rounded-2xl bg-surface-lowest p-6 shadow-ghost">
        <h3 className="font-serif text-lg font-semibold text-primary">Under CPA review</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          A licensed CPA is checking your documentation. Typical turnaround is under 24 hours.
          You&apos;ll get a notification when they respond.
        </p>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-2xl bg-surface-lowest p-6 shadow-ghost">
        <h3 className="font-serif text-lg font-semibold text-destructive">
          Verification not granted
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          The CPA could not verify accredited status from the evidence provided. You can start a
          new verification anytime from the dashboard.
        </p>
      </div>
    )
  }

  // Editable: draft or changes_requested
  const isResubmit = status === 'changes_requested'

  const onSubmit = () => {
    if (!attested) {
      toast.error('Please attest before submitting')
      return
    }
    const fd = new FormData()
    fd.set('submissionId', submissionId)
    fd.set('attested', 'true')
    startTransition(async () => {
      const res = await submitForReviewAction(fd)
      if (res && res.error) toast.error(res.error)
      else toast.success(isResubmit ? 'Resubmitted to CPA' : 'Submitted for CPA review')
    })
  }

  return (
    <div className="rounded-2xl bg-surface-lowest p-6 shadow-ghost">
      <h3 className="font-serif text-lg font-semibold text-primary">
        {isResubmit ? 'Resubmit for review' : 'Ready to submit?'}
      </h3>
      <p className="mt-1 text-sm text-on-surface-variant">
        {isResubmit
          ? 'When your updated documents are in, resubmit for CPA review.'
          : 'A licensed CPA will review your documents and issue a verification certificate.'}
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-low px-3 py-2 text-sm">
        <span className="text-on-surface-variant">Checklist</span>
        <span className={ready ? 'font-semibold text-[var(--success)]' : 'font-semibold text-secondary'}>
          {completion.filled} of {completion.total}
        </span>
      </div>

      {!ready && (
        <p className="mt-3 text-xs text-secondary">
          The CPA may still approve an incomplete submission, but a complete checklist speeds
          review.
        </p>
      )}

      <label className="mt-4 flex items-start gap-3 rounded-xl bg-surface-low p-3 text-sm">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-[var(--secondary)]"
        />
        <span>
          I attest that the uploaded documents and values are complete and accurate to the best of
          my knowledge.
        </span>
      </label>

      <Button
        size="lg"
        className="mt-4 w-full"
        onClick={onSubmit}
        disabled={pending || !attested}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Send className="h-4 w-4" />
            {isResubmit ? 'Resubmit for review' : 'Submit for CPA review'}
          </>
        )}
      </Button>
    </div>
  )
}
