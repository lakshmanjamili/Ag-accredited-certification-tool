'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UploadCloud,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Briefcase,
  DollarSign,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Document } from '@/db/schema'

type DocumentType = Document['type']

type SlotDef = {
  key: string
  title: string
  subtitle: string
  required: boolean
  acceptTypes: DocumentType[]
  year?: number
  targetType: DocumentType
  hint?: string
}

const SAFE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
])
const MAX_BYTES = 25 * 1024 * 1024

export function StructuredUploader({
  submissionId,
  verificationPath,
  filingStatus,
  docs,
}: {
  submissionId: string
  verificationPath: 'income' | 'net_worth' | 'professional' | 'entity_assets' | null
  filingStatus: string | null
  docs: Document[]
}) {
  const year = new Date().getUTCFullYear()
  const y1 = year - 1 // most recent (e.g., 2025 in 2026)
  const y2 = year - 2 // prior (e.g., 2024)

  const joint = filingStatus === 'mfj' || filingStatus === 'spousal_equivalent'
  const threshold = joint ? '$300,000' : '$200,000'

  // Per-year "have you filed?" state — defaults: prior year = filed, most recent = unknown
  const [filedY1, setFiledY1] = useState<boolean | null>(
    inferFiled(docs, y1),
  )
  const [currentEvidence, setCurrentEvidence] = useState<
    'paystub' | 'w2_ytd' | 'form_1040' | null
  >(inferCurrentEvidence(docs))

  // Build the slot list — changes based on "filed" toggle + path
  const slots: SlotDef[] = useMemo(() => {
    if (verificationPath === 'net_worth') {
      return [
        {
          key: 'bank',
          title: 'Bank statements',
          subtitle: 'Most recent month for every account',
          required: true,
          acceptTypes: ['bank_statement'],
          targetType: 'bank_statement',
        },
        {
          key: 'brokerage',
          title: 'Brokerage / retirement statements',
          subtitle: 'Any investment accounts',
          required: true,
          acceptTypes: ['brokerage_statement', 'retirement_statement'],
          targetType: 'brokerage_statement',
        },
        {
          key: 'liabilities',
          title: 'Liabilities',
          subtitle: 'Mortgages, loans, credit cards',
          required: false,
          acceptTypes: [
            'mortgage_statement',
            'loan_statement',
            'credit_card_statement',
          ],
          targetType: 'loan_statement',
        },
      ]
    }

    if (verificationPath === 'entity_assets') {
      return [
        {
          key: 'entity_financials',
          title: 'Entity financial statements',
          subtitle:
            'Audited statements, or unaudited + bank/brokerage totaling > $5M in assets',
          required: true,
          acceptTypes: [
            'entity_financials',
            'bank_statement',
            'brokerage_statement',
          ],
          targetType: 'entity_financials',
        },
        {
          key: 'entity_formation',
          title: 'Entity formation / good standing',
          subtitle:
            'Articles of incorporation, operating agreement, or certificate of good standing',
          required: true,
          acceptTypes: ['entity_formation', 'other'],
          targetType: 'entity_formation',
        },
        {
          key: 'entity_supporting',
          title: 'Supporting docs (optional)',
          subtitle: 'Beneficial-owner list, K-1s, resolutions — anything useful',
          required: false,
          acceptTypes: ['k1', 'other'],
          targetType: 'other',
        },
      ]
    }

    if (verificationPath === 'professional') {
      return [
        {
          key: 'finra_credential',
          title: 'FINRA credential',
          subtitle:
            'BrokerCheck PDF (from brokercheck.finra.org) or CRD snapshot, dated within 30 days',
          required: true,
          acceptTypes: ['finra_credential', 'other'],
          targetType: 'finra_credential',
        },
      ]
    }

    // Income path — per-year structured
    const list: SlotDef[] = []

    // Most recent year (Y1)
    if (filedY1 === true) {
      list.push({
        key: `y1_1040`,
        title: `Form 1040 — Tax Year ${y1}`,
        subtitle: `Your filed federal return for ${y1}. AGI must meet ${threshold}.`,
        required: true,
        acceptTypes: ['form_1040'],
        year: y1,
        targetType: 'form_1040',
        hint: '1040',
      })
    } else if (filedY1 === false) {
      list.push({
        key: `y1_w2`,
        title: `W-2 (Full Year) — Tax Year ${y1}`,
        subtitle: `You haven't filed yet. Upload every W-2 for ${y1}.`,
        required: true,
        acceptTypes: ['w2'],
        year: y1,
        targetType: 'w2',
        hint: 'w2',
      })
    }

    // Prior year (Y2) — always 1040 (tax return should be filed by now)
    list.push({
      key: `y2_1040`,
      title: `Form 1040 — Tax Year ${y2}`,
      subtitle: `Your filed federal return for ${y2}. AGI must meet ${threshold}.`,
      required: true,
      acceptTypes: ['form_1040'],
      year: y2,
      targetType: 'form_1040',
      hint: '1040',
    })

    // Current year evidence
    if (currentEvidence === 'paystub') {
      list.push({
        key: `current_paystub`,
        title: `Pay stubs — ${year}`,
        subtitle: 'Two recent pay stubs (last 60 days). Annualizes to current-year income.',
        required: true,
        acceptTypes: ['paystub'],
        year,
        targetType: 'paystub',
        hint: 'paystub',
      })
    } else if (currentEvidence === 'w2_ytd') {
      list.push({
        key: `current_w2_ytd`,
        title: `W-2 YTD — ${year}`,
        subtitle: 'Year-to-date earnings statement showing current-year gross.',
        required: true,
        acceptTypes: ['w2'],
        year,
        targetType: 'w2',
        hint: 'w2',
      })
    } else if (currentEvidence === 'form_1040') {
      list.push({
        key: `current_1040`,
        title: `Form 1040 — Tax Year ${year}`,
        subtitle: `You've already filed your ${year} return. Upload it as current-year evidence.`,
        required: true,
        acceptTypes: ['form_1040'],
        year,
        targetType: 'form_1040',
        hint: '1040',
      })
    }

    // Optional K-1 / supporting-income slot — never required
    list.push({
      key: 'supporting_income',
      title: 'Schedule K-1s & other supporting income (optional)',
      subtitle:
        'Partnership/S-corp K-1s, 1099-NEC/MISC/DIV, employer letters — useful if your 1040 has business income',
      required: false,
      acceptTypes: ['k1', 'other'],
      targetType: 'k1',
      hint: 'k1',
    })

    return list
  }, [verificationPath, filedY1, currentEvidence, y1, y2, year, threshold])

  // Assign uploaded docs to slots, leftovers go to "other"
  const { slotAssignments, unassigned } = useMemo(
    () => assignDocsToSlots(slots, docs),
    [slots, docs],
  )

  return (
    <div className="space-y-6">
      {/* Preamble */}
      {verificationPath === 'income' && (
        <div className="rounded-2xl bg-surface-low p-5">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
            SEC Rule 501(a)(6) — Three parts required
          </div>
          <ol className="space-y-1 text-sm text-on-surface-variant">
            <li>
              <span className="font-semibold text-on-surface">1.</span> Income ≥ {threshold}{' '}
              in each of the two most recent tax years ({y2} and {y1}).
            </li>
            <li>
              <span className="font-semibold text-on-surface">2.</span> Both years must
              independently meet the threshold.
            </li>
            <li>
              <span className="font-semibold text-on-surface">3.</span> Reasonable expectation
              of the same or more in {year}.
            </li>
          </ol>
        </div>
      )}

      {/* Year Y1 — toggle section */}
      {verificationPath === 'income' && (
        <SectionHeader
          icon={<Calendar className="h-4 w-4" strokeWidth={1.8} />}
          title={`Tax Year ${y1}`}
          subtitle="Most recent — tell us whether you've filed"
        >
          <div className="mt-4 flex gap-2">
            <ToggleButton
              active={filedY1 === true}
              onClick={() => setFiledY1(true)}
              label="Yes — filed"
            />
            <ToggleButton
              active={filedY1 === false}
              onClick={() => setFiledY1(false)}
              label="No — not yet filed"
            />
          </div>
        </SectionHeader>
      )}

      {/* Render Y1-related slots */}
      {slots
        .filter((s) => s.key.startsWith('y1_'))
        .map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            submissionId={submissionId}
            docs={slotAssignments[slot.key] ?? []}
          />
        ))}

      {/* Year Y2 section header */}
      {verificationPath === 'income' && (
        <SectionHeader
          icon={<Calendar className="h-4 w-4" strokeWidth={1.8} />}
          title={`Tax Year ${y2}`}
          subtitle="Prior year — tax return should be on file"
        />
      )}

      {slots
        .filter((s) => s.key.startsWith('y2_'))
        .map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            submissionId={submissionId}
            docs={slotAssignments[slot.key] ?? []}
          />
        ))}

      {/* Current year */}
      {verificationPath === 'income' && (
        <SectionHeader
          icon={<DollarSign className="h-4 w-4" strokeWidth={1.8} />}
          title={`Current Year ${year}`}
          subtitle="Income expectation — pick one"
        >
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ChoiceCard
              active={currentEvidence === 'paystub'}
              onClick={() => setCurrentEvidence('paystub')}
              title="Pay stubs"
              body="Last 2 months of pay stubs — we'll annualize."
              icon={<FileText className="h-4 w-4" strokeWidth={1.8} />}
            />
            <ChoiceCard
              active={currentEvidence === 'w2_ytd'}
              onClick={() => setCurrentEvidence('w2_ytd')}
              title="W-2 YTD"
              body="Year-to-date earnings summary."
              icon={<Briefcase className="h-4 w-4" strokeWidth={1.8} />}
            />
            <ChoiceCard
              active={currentEvidence === 'form_1040'}
              onClick={() => setCurrentEvidence('form_1040')}
              title={`${year} Form 1040`}
              body={`Already filed your ${year} return? Use it.`}
              icon={<FileText className="h-4 w-4" strokeWidth={1.8} />}
            />
          </div>
        </SectionHeader>
      )}

      {slots
        .filter((s) => s.key.startsWith('current_'))
        .map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            submissionId={submissionId}
            docs={slotAssignments[slot.key] ?? []}
          />
        ))}

      {/* Income path — optional K-1 / supporting docs slot */}
      {verificationPath === 'income' &&
        slots
          .filter((s) => s.key === 'supporting_income')
          .map((slot) => (
            <SlotCard
              key={slot.key}
              slot={slot}
              submissionId={submissionId}
              docs={slotAssignments[slot.key] ?? []}
            />
          ))}

      {/* Net worth / entity / professional paths — render every slot */}
      {(verificationPath === 'net_worth' ||
        verificationPath === 'entity_assets' ||
        verificationPath === 'professional') &&
        slots.map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            submissionId={submissionId}
            docs={slotAssignments[slot.key] ?? []}
          />
        ))}

      {unassigned.length > 0 && (
        <div className="rounded-2xl bg-secondary/5 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
            Extra files uploaded
          </div>
          <p className="text-xs text-on-surface-variant">
            These files weren&apos;t auto-matched to any slot. Your CPA can still see them,
            but they won&apos;t count toward the automatic check.
          </p>
          <ul className="mt-2 space-y-1">
            {unassigned.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 text-xs text-on-surface-variant"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="truncate">{d.fileName}</span>
                <span>· {d.type.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Slot components ───────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 border-t border-outline-variant/15 pt-6 first:border-0 first:pt-0">
      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-serif text-xl font-semibold italic text-primary">{title}</h3>
        <p className="text-sm text-on-surface-variant">{subtitle}</p>
        {children}
      </div>
    </div>
  )
}

function SlotCard({
  slot,
  submissionId,
  docs,
}: {
  slot: SlotDef
  submissionId: string
  docs: Document[]
}) {
  const matched = docs.filter((d) => d.extractionStatus === 'done')
  const pending = docs.filter((d) => d.extractionStatus !== 'done')
  const filled = matched.length > 0 || pending.length > 0

  return (
    <div
      className={cn(
        'rounded-2xl p-5 shadow-ghost transition-all',
        filled ? 'bg-surface-lowest ring-1 ring-[var(--success)]/20' : 'bg-surface-lowest',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-on-surface">{slot.title}</h4>
            {slot.required ? (
              <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-secondary">
                Required
              </span>
            ) : (
              <span className="rounded-full bg-surface-low px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
                Optional
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-on-surface-variant">{slot.subtitle}</p>
        </div>
        {matched.length > 0 && (
          <CheckCircle2 className="h-5 w-5 text-[var(--success)]" strokeWidth={2} />
        )}
      </div>

      <SlotDropzone submissionId={submissionId} slot={slot} />

      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => {
            const mismatch = !slot.acceptTypes.includes(d.type)
            return (
              <li
                key={d.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                  mismatch
                    ? 'bg-destructive/5 text-destructive'
                    : 'bg-surface-low text-on-surface',
                )}
              >
                {mismatch ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                )}
                <span className="truncate font-medium">{d.fileName}</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest">
                  {mismatch
                    ? `Expected ${slot.acceptTypes[0].replace('_', ' ')}`
                    : d.extractionStatus}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SlotDropzone({
  submissionId,
  slot,
}: {
  submissionId: string
  slot: SlotDef
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const uploadOne = useCallback(
    async (file: File) => {
      if (!SAFE_MIMES.has(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name}: unsupported file type`)
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: exceeds 25 MB`)
        return
      }

      const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
      const path = `submissions/${submissionId}/docs/${crypto.randomUUID()}.${ext}`
      const supabase = createClient()
      const bucket =
        process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'accreditation-docs'

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type || 'application/pdf' })
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`)
        return
      }
      // Smart type detection: if the filename clearly matches a different
      // type than the slot expects, use the inferred type (the CPA's checklist
      // will show it in the right place). Prevents the "paystub tagged as
      // form_1040" failure we were seeing.
      const inferred = inferFromFilename(file.name)
      const actualType =
        inferred && inferred !== slot.targetType ? inferred : slot.targetType

      const extractingToast = toast.loading(
        `Reading ${file.name}… Azure Document Intelligence is extracting key fields.`,
      )
      const res = await fetch(`/api/submissions/${submissionId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: actualType,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          sizeBytes: file.size,
        }),
      })
      toast.dismiss(extractingToast)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(`Failed to register document: ${body.error ?? res.statusText}`)
        return
      }
      const responseBody = (await res.json().catch(() => null)) as {
        ok?: boolean
        extraction?: {
          status: 'done' | 'failed'
          confidence?: number | null
          fallbackUsed?: boolean
          fallbackReason?: string | null
          error?: string
          fields?: Array<{ label: string; value: string | null; highlight?: boolean }>
        }
      } | null
      const extraction = responseBody?.extraction
      const routingMsg =
        inferred && inferred !== slot.targetType
          ? ` · routed to ${inferred.replace('_', ' ')}`
          : ''

      if (extraction?.status === 'done') {
        const highlights = (extraction.fields ?? []).filter((f) => f.highlight)
        const pct =
          typeof extraction.confidence === 'number'
            ? ` · ${(extraction.confidence * 100).toFixed(0)}% confidence`
            : ''
        if (extraction.fallbackUsed) {
          toast.success(
            `Uploaded ${file.name} · read via layout OCR (specialized model unavailable in this Azure region)${routingMsg}`,
          )
        } else {
          toast.success(
            `Extracted ${highlights.length} key value${highlights.length === 1 ? '' : 's'} from ${file.name}${pct}${routingMsg}`,
          )
        }
      } else if (extraction?.status === 'failed') {
        toast.error(
          `Uploaded ${file.name}, but extraction failed: ${extraction.error ?? 'unknown'}`,
        )
      } else {
        toast.success(`Uploaded ${file.name}${routingMsg}`)
      }
      router.refresh()
    },
    [router, slot.targetType, submissionId],
  )

  const runUploads = async (files: FileList | File[]) => {
    setUploading(true)
    try {
      for (const f of Array.from(files)) await uploadOne(f)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!dragOver) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (!uploading) runUploads(e.dataTransfer.files)
      }}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition-colors',
        dragOver
          ? 'border-secondary bg-secondary/5'
          : 'border-outline-variant/40 bg-surface-low hover:border-secondary/50 hover:bg-secondary/5',
      )}
    >
      <div className="flex items-center gap-3">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-5 w-5 text-primary" strokeWidth={1.8} />
        )}
        <div>
          <div className="font-medium text-on-surface">
            {uploading ? 'Uploading…' : 'Drop a file or click to browse'}
          </div>
          <div className="text-[11px] text-on-surface-variant">
            PDF / JPG / PNG · up to 25 MB each
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-on-surface-variant/50" strokeWidth={1.5} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && runUploads(e.target.files)}
      />
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
        active
          ? 'bg-primary text-white shadow-sm'
          : 'bg-surface-low text-on-surface hover:bg-surface-container',
      )}
    >
      {label}
    </button>
  )
}

function ChoiceCard({
  active,
  onClick,
  title,
  body,
  icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  body: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl p-3 text-left transition-all',
        active
          ? 'bg-secondary/5 ring-2 ring-secondary'
          : 'bg-surface-low hover:bg-surface-container',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-secondary text-white' : 'bg-primary/5 text-primary',
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-on-surface">{title}</div>
        <div className="text-xs text-on-surface-variant">{body}</div>
      </div>
    </button>
  )
}

// ─── helpers ───────────────────────────────────────────────────────────

function inferFromFilename(name: string): DocumentType | null {
  const n = name.toLowerCase()
  if (n.includes('1040')) return 'form_1040'
  if (n.includes('w-2') || n.includes('w2')) return 'w2'
  if (n.includes('paystub') || n.includes('pay-stub') || n.includes('pay_stub')) {
    return 'paystub'
  }
  if (
    n.includes('schedule-k1') ||
    n.includes('schedule_k1') ||
    n.includes('k-1') ||
    n.includes('_k1_') ||
    n.startsWith('k1') ||
    n.endsWith('k1.pdf')
  )
    return 'k1'
  if (n.includes('brokercheck') || n.includes('finra') || n.includes('crd'))
    return 'finra_credential'
  if (
    n.includes('articles') ||
    n.includes('incorporation') ||
    n.includes('operating-agreement') ||
    n.includes('good-standing') ||
    n.includes('certificate-of-formation')
  )
    return 'entity_formation'
  if (
    n.includes('balance-sheet') ||
    n.includes('financial-statements') ||
    n.includes('income-statement') ||
    n.includes('p&l') ||
    n.includes('pnl')
  )
    return 'entity_financials'
  if (n.includes('bank')) return 'bank_statement'
  if (n.includes('brokerage') || n.includes('fidelity') || n.includes('schwab'))
    return 'brokerage_statement'
  if (n.includes('401k') || n.includes('ira') || n.includes('retire'))
    return 'retirement_statement'
  if (n.includes('mortgage')) return 'mortgage_statement'
  return null
}

function inferFiled(docs: Document[], year: number): boolean | null {
  const has1040 = docs.some((d) => {
    if (d.type !== 'form_1040') return false
    const raw = d.rawExtraction as { taxYear?: number } | null
    return raw?.taxYear === year || d.fileName.includes(String(year))
  })
  if (has1040) return true
  const hasW2 = docs.some((d) => {
    if (d.type !== 'w2') return false
    const raw = d.rawExtraction as { taxYear?: number } | null
    return raw?.taxYear === year || d.fileName.includes(String(year))
  })
  if (hasW2) return false
  return null
}

function inferCurrentEvidence(
  docs: Document[],
): 'paystub' | 'w2_ytd' | 'form_1040' | null {
  if (docs.some((d) => d.type === 'paystub')) return 'paystub'
  const year = new Date().getUTCFullYear()
  const hasCurrentYear1040 = docs.some((d) => {
    if (d.type !== 'form_1040') return false
    const raw = d.rawExtraction as { taxYear?: number } | null
    return raw?.taxYear === year || d.fileName.includes(String(year))
  })
  if (hasCurrentYear1040) return 'form_1040'
  const hasCurrentW2 = docs.some((d) => {
    if (d.type !== 'w2') return false
    const raw = d.rawExtraction as { taxYear?: number } | null
    return raw?.taxYear === year || d.fileName.includes(String(year))
  })
  if (hasCurrentW2) return 'w2_ytd'
  return null
}

function assignDocsToSlots(
  slots: SlotDef[],
  docs: Document[],
): { slotAssignments: Record<string, Document[]>; unassigned: Document[] } {
  const slotAssignments: Record<string, Document[]> = {}
  const used = new Set<string>()

  for (const slot of slots) {
    const picks: Document[] = []
    // Prefer exact match on both type + year
    for (const d of docs) {
      if (used.has(d.id)) continue
      if (!slot.acceptTypes.includes(d.type)) continue
      if (slot.year != null) {
        const raw = d.rawExtraction as { taxYear?: number } | null
        const yr = raw?.taxYear ?? filenameYear(d.fileName)
        if (yr != null && yr !== slot.year) continue
      }
      picks.push(d)
      used.add(d.id)
    }
    slotAssignments[slot.key] = picks
  }

  const unassigned = docs.filter((d) => !used.has(d.id))
  return { slotAssignments, unassigned }
}

function filenameYear(name: string): number | null {
  // Underscores are word chars, so `\b` doesn't fire around "_2026_" —
  // use digit lookarounds to catch 4-digit years regardless of punctuation.
  const m = name.match(/(?<!\d)(20\d{2})(?!\d)/)
  return m ? Number(m[1]) : null
}
