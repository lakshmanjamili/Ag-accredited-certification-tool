'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UploadCloud, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { documentTypeEnum } from '@/db/schema'

type DocumentType = (typeof documentTypeEnum.enumValues)[number]

const SAFE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB

export function UploadZone({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const uploadFile = useCallback(
    async (file: File, type: DocumentType) => {
      if (!SAFE_MIMES.has(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`Unsupported file type: ${file.type || file.name}`)
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error('File exceeds 20 MB limit')
        return
      }

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `submissions/${submissionId}/docs/${crypto.randomUUID()}.${ext}`

      const supabase = createClient()
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type || 'application/pdf' })
      if (uploadErr) {
        toast.error(`Upload failed: ${uploadErr.message}`)
        return
      }

      const res = await fetch(`/api/submissions/${submissionId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          sizeBytes: file.size,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(`Failed to register document: ${body.error ?? res.statusText}`)
        return
      }
      toast.success(`Uploaded ${file.name}`)
      router.refresh()
    },
    [router, submissionId],
  )

  const onPick = async (files: FileList | null, type: DocumentType) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) await uploadFile(f, type)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    setUploading(true)
    try {
      for (const f of Array.from(e.dataTransfer.files)) {
        // Best-effort type inference from filename
        const t = inferType(f.name)
        await uploadFile(f, t)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed p-6 transition-colors',
        dragOver ? 'border-[var(--secondary)] bg-[var(--secondary)]/5' : 'border-border',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center text-center">
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
        )}
        <h3 className="mt-3 font-semibold">Drop documents here</h3>
        <p className="mt-1 text-sm text-muted-foreground">PDF, JPG, PNG, HEIC · up to 20 MB each</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UPLOAD_BUTTONS.map((b) => (
            <button
              key={b.type}
              type="button"
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
              onClick={() => {
                if (!fileInputRef.current) return
                fileInputRef.current.dataset.type = b.type
                fileInputRef.current.click()
              }}
              disabled={uploading}
            >
              {b.label}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) =>
            onPick(e.target.files, (e.currentTarget.dataset.type as DocumentType) || 'other')
          }
        />
      </div>
    </div>
  )
}

const UPLOAD_BUTTONS: { type: DocumentType; label: string }[] = [
  { type: 'form_1040', label: 'Form 1040' },
  { type: 'w2', label: 'W-2' },
  { type: 'paystub', label: 'Pay stub' },
  { type: 'bank_statement', label: 'Bank stmt' },
  { type: 'brokerage_statement', label: 'Brokerage' },
  { type: 'other', label: 'Other' },
]

function inferType(fileName: string): DocumentType {
  const n = fileName.toLowerCase()
  if (n.includes('1040')) return 'form_1040'
  if (n.includes('w-2') || n.includes('w2')) return 'w2'
  if (n.includes('paystub') || n.includes('pay-stub') || n.includes('pay_stub')) return 'paystub'
  if (n.includes('bank')) return 'bank_statement'
  if (n.includes('brokerage') || n.includes('fidelity') || n.includes('schwab')) {
    return 'brokerage_statement'
  }
  if (n.includes('401k') || n.includes('ira') || n.includes('retire')) return 'retirement_statement'
  if (n.includes('mortgage')) return 'mortgage_statement'
  return 'other'
}
