'use client'

import { useState } from 'react'
import {
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspectorDoc } from './document-inspector'

/**
 * Side-by-side CPA review.
 *
 * Tabs along the top → one PDF viewer on the left, the extracted fields
 * for *that specific document* on the right. Clicking a different tab
 * updates both panes together. This is the "human in the loop" surface.
 */
export function SplitReview({ docs }: { docs: InspectorDoc[] }) {
  const [activeId, setActiveId] = useState(docs[0]?.id ?? null)
  const active = docs.find((d) => d.id === activeId) ?? docs[0]

  if (docs.length === 0) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-paper p-10 text-center elev">
        <FileText className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.2} />
        <h3 className="mt-3 font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
          No documents uploaded
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">
          The customer hasn&apos;t uploaded anything yet.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-paper elev">
      {/* Tab strip — click any to swap both panes */}
      <div
        className="thin-scroll flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-bone px-3 py-2"
      >
        {docs.map((d) => {
          const isActive = d.id === active?.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveId(d.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-[6px] px-3 py-2 text-left transition-colors',
                isActive
                  ? 'bg-paper text-ink elev'
                  : 'text-slate-600 hover:bg-paper/60',
              )}
            >
              <StatusIcon status={d.summary.extractionStatus} />
              <div className="min-w-0 max-w-[200px]">
                <div className="truncate text-[12.5px] font-semibold">
                  {d.fileName}
                </div>
                <div className="truncate text-[10px] text-slate-500">
                  {d.type.replace('_', ' ')}
                  {d.summary.confidence != null &&
                    ` · ${(d.summary.confidence * 100).toFixed(0)}%`}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Split pane — PDF left, fields right, both tied to active tab.
          Uses `md` breakpoint (768px) so it still renders side-by-side inside
          the narrower `xl:grid-cols-[2fr,1fr]` parent on the admin page. */}
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr,1fr]">
        {/* LEFT — PDF */}
        <div
          className="relative border-b border-slate-200 bg-slate-100 md:border-b-0 md:border-r"
          style={{ minHeight: 640 }}
        >
          {active?.signedUrl ? (
            <iframe
              key={active.id}
              src={active.signedUrl}
              title={active.fileName}
              className="h-full w-full"
              style={{ minHeight: 640 }}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-slate-500">
              <FileText className="h-12 w-12 text-slate-300" strokeWidth={1.2} />
              <div className="text-[13px]">Document preview unavailable</div>
              <div className="text-[11px] text-slate-400">
                The signed URL expired or the file isn&apos;t a PDF.
              </div>
            </div>
          )}

          {active?.signedUrl && (
            <a
              href={active.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[6px] bg-paper/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur hover:bg-paper"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
              Open full screen
            </a>
          )}
        </div>

        {/* RIGHT — extracted values for the active doc only */}
        <div
          className="flex flex-col overflow-y-auto bg-paper thin-scroll"
          style={{ maxHeight: '80vh' }}
        >
          {active && <ActiveDocFields doc={active} />}
        </div>
      </div>
    </div>
  )
}

function ActiveDocFields({ doc }: { doc: InspectorDoc }) {
  const conf = doc.summary.confidence
  const highlights = doc.summary.fields.filter((f) => f.highlight)
  const others = doc.summary.fields.filter((f) => !f.highlight)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-200 bg-bone px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
              Extracted from
            </div>
            <h3
              className="mt-0.5 truncate font-serif text-[16px] text-ink"
              style={{ fontWeight: 600 }}
            >
              {doc.fileName}
            </h3>
            <div className="mt-1 text-[11px] text-slate-500">
              {doc.type.replace('_', ' ')} ·{' '}
              {conf != null ? `${(conf * 100).toFixed(0)}% overall confidence` : '—'}
            </div>
          </div>
          <ExtractionChip status={doc.summary.extractionStatus} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 p-5">
        {doc.summary.extractionStatus !== 'done' ? (
          <div className="rounded-[6px] bg-slate-50 p-4 text-[12px] text-slate-500">
            <Loader2 className="mb-2 h-4 w-4 animate-spin" strokeWidth={1.8} />
            Azure Document Intelligence is analyzing this document. Refresh in a few
            seconds.
          </div>
        ) : (
          <>
            {highlights.length > 0 && (
              <section>
                <div className="smallcaps mb-2 text-[10px] tracking-[.18em] text-[#8E6F10]">
                  Key values
                </div>
                <dl className="divide-y divide-slate-100 rounded-[8px] border border-slate-200 bg-paper">
                  {highlights.map((f, i) => (
                    <FieldRow key={i} field={f} highlight />
                  ))}
                </dl>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <div className="smallcaps mb-2 text-[10px] tracking-[.18em] text-slate-500">
                  All fields
                </div>
                <dl className="divide-y divide-slate-100 rounded-[8px] border border-slate-200 bg-paper">
                  {others.map((f, i) => (
                    <FieldRow key={i} field={f} />
                  ))}
                </dl>
              </section>
            )}

            {highlights.length === 0 && others.length === 0 && (
              <div className="rounded-[6px] bg-[var(--warn-50)] p-4 text-[12px] text-[var(--warn)]">
                Azure returned no key values for this document. Please review the PDF on
                the left directly and enter any relevant data in your decision notes.
              </div>
            )}

            {doc.summary.textPreview && (
              <details className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                <summary className="smallcaps cursor-pointer text-[10px] font-bold tracking-[.18em] text-slate-500 hover:text-ink">
                  Raw OCR text (first 2,000 chars)
                </summary>
                <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-[4px] bg-paper p-3 text-[10.5px] leading-[1.5] text-slate-600">
                  {doc.summary.textPreview}
                </pre>
              </details>
            )}

            {doc.summary.azureModelId && (
              <div className="smallcaps flex items-center gap-2 text-[9.5px] tracking-[.15em] text-slate-400">
                <Eye className="h-3 w-3" strokeWidth={1.8} />
                Model: {doc.summary.azureModelId}
                {doc.summary.docType ? ` · ${doc.summary.docType}` : ''}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FieldRow({
  field,
  highlight,
}: {
  field: {
    label: string
    value: string
    highlight?: boolean
    confidence?: number | null
  }
  highlight?: boolean
}) {
  const c = field.confidence
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 px-4 py-2',
        highlight && 'bg-[var(--gold-50)]/40',
      )}
    >
      <dt
        className={cn(
          'min-w-0 flex-shrink-0 truncate text-[11px]',
          highlight
            ? 'font-semibold uppercase tracking-wider text-[#8E6F10]'
            : 'text-slate-500',
        )}
        style={{ maxWidth: '50%' }}
      >
        {field.label}
      </dt>
      <dd
        className={cn(
          'text-right font-mono text-[12.5px] tabular-nums',
          highlight ? 'font-bold text-ink' : 'text-slate-800',
        )}
      >
        {field.value}
        {c != null && (
          <span
            className={cn(
              'ml-2 text-[9.5px] font-bold',
              c >= 0.8
                ? 'text-[var(--success)]'
                : c >= 0.6
                ? 'text-secondary'
                : 'text-destructive',
            )}
          >
            {(c * 100).toFixed(0)}%
          </span>
        )}
      </dd>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done')
    return (
      <CheckCircle2
        className="h-3.5 w-3.5 shrink-0 text-[var(--success)]"
        strokeWidth={2}
      />
    )
  if (status === 'in_progress')
    return (
      <Loader2
        className="h-3.5 w-3.5 shrink-0 animate-spin text-secondary"
        strokeWidth={2}
      />
    )
  if (status === 'failed')
    return (
      <AlertTriangle
        className="h-3.5 w-3.5 shrink-0 text-destructive"
        strokeWidth={2}
      />
    )
  return (
    <Loader2
      className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400"
      strokeWidth={2}
    />
  )
}

function ExtractionChip({ status }: { status: string }) {
  if (status === 'done')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
        Extracted
      </span>
    )
  if (status === 'in_progress')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        Running
      </span>
    )
  if (status === 'failed')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--danger)]">
        <AlertTriangle className="h-3 w-3" strokeWidth={2} />
        Failed
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
      Queued
    </span>
  )
}
