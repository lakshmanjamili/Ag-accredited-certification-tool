'use client'

import { useState, useTransition } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { decisionAction } from '@/app/admin/actions'
import { toast } from 'sonner'

type Decision = 'approve' | 'request_changes' | 'reject'

export function DecisionPanel({
  submissionId,
  disabled,
  onApproved,
}: {
  submissionId: string
  disabled?: boolean
  onApproved?: () => void
}) {
  const [decision, setDecision] = useState<Decision>('approve')
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (decision !== 'approve' && !notes.trim()) {
      toast.error('Notes required for changes / rejection')
      return
    }
    const fd = new FormData()
    fd.set('submissionId', submissionId)
    fd.set('decision', decision)
    fd.set('notes', notes)
    startTransition(async () => {
      const res = await decisionAction(fd)
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Decision recorded: ${decision.replace('_', ' ')}`)
        setNotes('')
        if (decision === 'approve') onApproved?.()
      }
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold">Decision</h3>
      <div className="grid grid-cols-3 gap-2">
        <DecisionOption
          active={decision === 'approve'}
          onClick={() => setDecision('approve')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Approve"
          tone="success"
        />
        <DecisionOption
          active={decision === 'request_changes'}
          onClick={() => setDecision('request_changes')}
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Request"
          tone="warning"
        />
        <DecisionOption
          active={decision === 'reject'}
          onClick={() => setDecision('reject')}
          icon={<XCircle className="h-4 w-4" />}
          label="Reject"
          tone="destructive"
        />
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Notes {decision !== 'approve' && <span className="text-destructive">*</span>}
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
        placeholder={
          decision === 'approve'
            ? 'Optional — internal CPA notes'
            : 'What needs to change, or reason for rejection?'
        }
      />

      <Button
        variant="accent"
        size="lg"
        className="mt-4 w-full"
        disabled={pending || disabled}
        onClick={submit}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record decision'}
      </Button>
    </div>
  )
}

function DecisionOption({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  tone: 'success' | 'warning' | 'destructive'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'warning'
      ? 'text-[var(--warning)]'
      : 'text-destructive'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
        active
          ? 'border-[var(--secondary)] bg-[var(--secondary)]/5'
          : 'border-border hover:bg-muted'
      }`}
    >
      <span className={toneClass}>{icon}</span>
      {label}
    </button>
  )
}
