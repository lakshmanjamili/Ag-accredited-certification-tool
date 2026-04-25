'use client'

import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { Loader2, Undo2, X, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveAdminSignatureAction, clearAdminSignatureAction } from './actions'
import { toast } from 'sonner'

export function AdminSignatureManager({
  existingUrl,
  hasSignature,
}: {
  existingUrl: string | null
  hasSignature: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [editing, setEditing] = useState(!hasSignature)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d')?.scale(ratio, ratio)
    const pad = new SignaturePad(canvas, {
      penColor: '#0B1F3A',
      minWidth: 1,
      maxWidth: 2.5,
    })
    pad.addEventListener('endStroke', () => setReady(!pad.isEmpty()))
    padRef.current = pad
    return () => pad.off()
  }, [editing])

  const save = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error('Draw your signature first')
      return
    }
    setPending(true)
    try {
      const dataUrl = padRef.current.toDataURL('image/png')
      const fd = new FormData()
      fd.set('signatureDataUrl', dataUrl)
      const res = await saveAdminSignatureAction(fd)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Signature saved — you can now one-click approve.')
        setEditing(false)
      }
    } finally {
      setPending(false)
    }
  }

  const clear = async () => {
    if (!confirm('Remove your saved signature? You can redraw it anytime.')) return
    setPending(true)
    try {
      await clearAdminSignatureAction()
      toast.success('Signature removed')
      setEditing(true)
    } finally {
      setPending(false)
    }
  }

  if (!editing && hasSignature) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-paper p-5 elev">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
              Saved signature
            </div>
            <p className="mt-1 text-[13px] text-slate-600">
              Used automatically when you approve &amp; sign a certificate.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[var(--success-50)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--success)]">
            <Check className="h-3 w-3" strokeWidth={2} /> On file
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center rounded-[6px] border border-dashed border-slate-200 bg-bone p-6">
          {existingUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={existingUrl} alt="Your signature" className="max-h-20" />
          ) : (
            <span className="text-[12px] text-slate-400">Signature preview unavailable</span>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={clear} disabled={pending}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-slate-200 bg-paper p-5 elev">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
            Save your signature
          </div>
          <p className="mt-1 text-[13px] text-slate-600">
            Draw once. Every certificate you approve is auto-signed with this image —
            no re-drawing each time.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[6px] border border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full rounded-[6px]"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Draw with mouse, trackpad, or finger.</span>
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
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50"
          >
            <Undo2 className="h-3 w-3" strokeWidth={1.8} />
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear()
              setReady(false)
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50"
          >
            <X className="h-3 w-3" strokeWidth={1.8} />
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="default" size="sm" onClick={save} disabled={pending || !ready}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4" strokeWidth={1.8} />
              Save signature
            </>
          )}
        </Button>
        {hasSignature && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Keep existing
          </Button>
        )}
      </div>
    </div>
  )
}
