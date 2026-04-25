'use client'

import { useState, useTransition } from 'react'
import { Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { approveAndSignAction } from '@/app/admin/actions'
import { toast } from 'sonner'

export function QuickApprovePanel({
  submissionId,
  cpaName,
  signaturePreviewUrl,
}: {
  submissionId: string
  cpaName: string
  signaturePreviewUrl: string | null
}) {
  const [certified, setCertified] = useState(false)
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!certified) {
      toast.error('Please confirm the certification statement')
      return
    }
    const fd = new FormData()
    fd.set('submissionId', submissionId)
    fd.set('certificationConfirmed', 'true')
    if (notes.trim()) fd.set('notes', notes.trim())

    startTransition(async () => {
      const res = await approveAndSignAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success(`Approved · certificate ${res.certificateNumber} issued`)
    })
  }

  return (
    <div className="rounded-[10px] border border-[var(--gold)]/40 bg-[var(--gold-50)]/40 p-5">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-50)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#8E6F10]">
        <Zap className="h-3 w-3" strokeWidth={2} />
        One-click approve &amp; sign
      </div>
      <h3 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
        Fast path · auto-use your saved signature
      </h3>
      <p className="mt-1 text-[12.5px] text-slate-600">
        Your saved signature is on file. Confirm below and we&apos;ll approve, sign, and
        issue the certificate in one action.
      </p>

      {signaturePreviewUrl && (
        <div className="mt-4 flex items-center justify-center rounded-[6px] border border-dashed border-slate-200 bg-paper p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signaturePreviewUrl}
            alt={`${cpaName} signature`}
            className="max-h-14"
          />
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Optional internal notes"
        className="mt-3 w-full rounded-[6px] border border-slate-200 bg-paper p-2 text-[13px]"
      />

      <label className="mt-3 flex items-start gap-2 rounded-[6px] bg-paper p-2.5 text-[12px] text-slate-700">
        <input
          type="checkbox"
          checked={certified}
          onChange={(e) => setCertified(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--gold)]"
        />
        <span>
          I, {cpaName}, certify that I have reviewed all uploaded documentation and, in my
          professional judgment as a CPA, this investor meets the SEC Rule 501(a)
          accreditation standard.
        </span>
      </label>

      <Button
        variant="gold"
        size="lg"
        className="mt-4 w-full"
        disabled={pending || !certified}
        onClick={submit}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Zap className="h-4 w-4" strokeWidth={1.8} />
            Approve &amp; auto-sign
          </>
        )}
      </Button>
    </div>
  )
}
