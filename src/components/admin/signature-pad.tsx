'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { Loader2, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signAndGenerateAction } from '@/app/admin/actions'
import { toast } from 'sonner'

export function SignAndGeneratePanel({
  submissionId,
  cpa,
}: {
  submissionId: string
  cpa: {
    name: string
    title: string
    license: string
    firm: string
    jurisdiction: string
    email: string
  }
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [certified, setCertified] = useState(false)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)
    const pad = new SignaturePad(canvas, { penColor: '#0b1020', minWidth: 1, maxWidth: 2.5 })
    pad.addEventListener('endStroke', () => setReady(!pad.isEmpty()))
    padRef.current = pad
    return () => pad.off()
  }, [])

  const submit = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error('Please draw your signature')
      return
    }
    if (!certified) {
      toast.error('Please confirm the certification statement')
      return
    }
    setPending(true)
    try {
      const dataUrl = padRef.current.toDataURL('image/png')
      const fd = new FormData()
      fd.set('submissionId', submissionId)
      fd.set('signatureDataUrl', dataUrl)
      fd.set('certificationConfirmed', 'true')
      const res = await signAndGenerateAction(fd)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Certificate ${res.certificateNumber} generated`)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Sign &amp; generate certificate</h3>

      <dl className="mt-4 grid grid-cols-2 gap-y-2 rounded-xl bg-muted/40 p-3 text-xs">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="font-medium">{cpa.name}</dd>
        <dt className="text-muted-foreground">Title</dt>
        <dd className="font-medium">{cpa.title}</dd>
        <dt className="text-muted-foreground">License</dt>
        <dd className="font-medium">{cpa.license || '—'}</dd>
        <dt className="text-muted-foreground">Firm</dt>
        <dd className="font-medium">{cpa.firm || '—'}</dd>
        <dt className="text-muted-foreground">Jurisdiction</dt>
        <dd className="font-medium">{cpa.jurisdiction || '—'}</dd>
      </dl>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Signature
      </label>
      <div className="mt-1 rounded-xl border border-dashed border-border bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full rounded-xl"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div>Draw with mouse, trackpad, or finger.</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              const pad = padRef.current
              if (!pad) return
              const data = pad.toData()
              if (data.length > 0) {
                data.pop()
                pad.fromData(data)
                setReady(data.length > 0)
              }
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear()
              setReady(false)
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-xs">
        <input
          type="checkbox"
          checked={certified}
          onChange={(e) => setCertified(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--secondary)]"
        />
        <span>
          I certify that I have personally reviewed all uploaded documentation and, in my
          professional judgment as a licensed CPA, this investor meets the SEC Rule 501(a)
          accreditation standard.
        </span>
      </label>

      <Button
        variant="accent"
        size="lg"
        className="mt-4 w-full"
        disabled={pending || !ready || !certified}
        onClick={submit}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign & generate certificate'}
      </Button>
    </div>
  )
}
