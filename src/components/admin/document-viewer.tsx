'use client'

import { useState } from 'react'
import { FileText, ExternalLink, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspectorDoc } from './document-inspector'

/**
 * Split-view document reviewer for the CPA.
 *
 * Left rail: tab strip of all uploaded documents with filename, type, status.
 * Main pane: iframe PDF preview of the active doc (via short-lived signed URL).
 *
 * The extracted fields + rule evaluation live OUTSIDE this component, to the
 * right. This component is just the document viewer.
 */
export function DocumentViewer({ docs }: { docs: InspectorDoc[] }) {
  const [activeId, setActiveId] = useState(docs[0]?.id ?? null)
  const active = docs.find((d) => d.id === activeId) ?? docs[0]

  if (docs.length === 0) {
    return (
      <div className="rounded-[10px] border border-slate-200 bg-paper p-10 text-center elev">
        <FileText
          className="mx-auto h-10 w-10 text-slate-300"
          strokeWidth={1.2}
        />
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
      {/* Document tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-bone px-3 py-2 thin-scroll">
        {docs.map((d) => {
          const isActive = d.id === active?.id
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveId(d.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-[6px] px-3 py-1.5 text-left transition-colors',
                isActive
                  ? 'bg-paper text-ink elev'
                  : 'text-slate-600 hover:bg-paper/60',
              )}
            >
              <StatusIcon status={d.summary.extractionStatus} />
              <div className="min-w-0 max-w-[220px]">
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

      {/* Viewer */}
      <div className="relative bg-slate-100" style={{ height: '72vh', minHeight: 520 }}>
        {active?.signedUrl ? (
          <iframe
            key={active.id}
            src={active.signedUrl}
            title={active.fileName}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <FileText className="h-12 w-12 text-slate-300" strokeWidth={1.2} />
            <div className="text-[13px]">Document preview unavailable</div>
            <div className="text-[11px] text-slate-400">
              The signed URL expired or the file isn&apos;t a PDF.
            </div>
          </div>
        )}

        {/* Open-in-new-tab button */}
        {active?.signedUrl && (
          <a
            href={active.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-[6px] bg-paper/95 px-2.5 py-1.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur hover:bg-paper"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
            Open in new tab
          </a>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'done')
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" strokeWidth={2} />
  if (status === 'in_progress')
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-secondary" strokeWidth={2} />
  if (status === 'failed')
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={2} />
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" strokeWidth={2} />
}
