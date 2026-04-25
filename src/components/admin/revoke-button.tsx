'use client'

import { useState, useTransition } from 'react'
import { Loader2, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { revokeCertificateAction } from '@/app/admin/actions'
import { toast } from 'sonner'

export function RevokeCertificateButton({
  certificateId,
  certificateNumber,
}: {
  certificateId: string
  certificateNumber: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (reason.trim().length < 5) {
      toast.error('Please provide a revocation reason (at least 5 characters)')
      return
    }
    const fd = new FormData()
    fd.set('certificateId', certificateId)
    fd.set('reason', reason.trim())
    startTransition(async () => {
      const res = await revokeCertificateAction(fd)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Certificate ${certificateNumber} revoked`)
        setOpen(false)
      }
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-destructive/30 text-destructive hover:bg-destructive/5"
        onClick={() => setOpen(true)}
      >
        <ShieldOff className="h-4 w-4" strokeWidth={1.8} />
        Revoke
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="text-[11px] font-bold uppercase tracking-widest text-destructive">
        Revoke {certificateNumber}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for revocation (will be shown publicly)"
        rows={3}
        className="w-full rounded-lg border border-outline-variant/40 bg-surface-lowest p-2 text-sm focus-visible:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/20"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={submit}
          disabled={pending}
          className="flex-1"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Confirm revocation'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
