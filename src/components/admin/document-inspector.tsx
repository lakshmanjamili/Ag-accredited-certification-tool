import { FileText, ExternalLink, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ExtractedSummary } from '@/lib/aggregate-extraction'

type InspectorDoc = {
  id: string
  fileName: string
  type: string
  uploadedAt: Date
  signedUrl: string | null
  summary: ExtractedSummary
}

export function DocumentInspectorList({ docs }: { docs: InspectorDoc[] }) {
  if (docs.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-lowest p-10 text-center shadow-ghost">
        <FileText className="mx-auto h-10 w-10 text-on-surface-variant/40" strokeWidth={1.2} />
        <h3 className="mt-4 font-serif text-lg text-primary">No documents uploaded</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          The customer hasn&apos;t uploaded anything yet.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {docs.map((d) => (
        <DocumentCard key={d.id} doc={d} />
      ))}
    </div>
  )
}

function DocumentCard({ doc }: { doc: InspectorDoc }) {
  const conf = doc.summary.confidence
  const confLabel =
    conf == null ? null : `${(conf * 100).toFixed(0)}%`
  const confTone =
    conf == null
      ? 'outline'
      : conf >= 0.8
      ? 'success'
      : conf >= 0.6
      ? 'warning'
      : 'destructive'

  return (
    <div className="rounded-2xl bg-surface-lowest p-5 shadow-ghost">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
            <FileText className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-snug text-on-surface">{doc.fileName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              <span className="capitalize">{doc.type.replace('_', ' ')}</span>
              <span>·</span>
              <span>
                Uploaded{' '}
                {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                  doc.uploadedAt,
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ExtractionChip status={doc.summary.extractionStatus} />
          {confLabel && (
            <Badge variant={confTone}>
              {confLabel}
            </Badge>
          )}
        </div>
      </div>

      {doc.summary.fields.length > 0 && (
        <dl className="mt-4 divide-y divide-outline-variant/15 rounded-xl bg-surface-low">
          {doc.summary.fields.map((f, i) => (
            <div
              key={i}
              className={`flex items-baseline justify-between gap-4 px-4 py-2 ${
                f.highlight ? 'bg-secondary/5' : ''
              }`}
            >
              <dt className="text-xs uppercase tracking-widest text-on-surface-variant">
                {f.label}
              </dt>
              <dd
                className={`flex items-baseline gap-2 text-right text-sm tabular-nums ${
                  f.highlight ? 'font-bold text-primary' : 'text-on-surface'
                }`}
              >
                <span className="font-mono">{f.value}</span>
                {f.confidence != null && (
                  <span
                    className={`text-[10px] font-semibold ${
                      f.confidence >= 0.8
                        ? 'text-[var(--success)]'
                        : f.confidence >= 0.6
                        ? 'text-secondary'
                        : 'text-destructive'
                    }`}
                  >
                    {(f.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {doc.summary.fallbackUsed && (
        <div className="mt-3 rounded-lg bg-secondary/10 px-3 py-2 text-[11px] leading-snug text-on-surface">
          <span className="font-bold uppercase tracking-widest text-secondary">
            Layout fallback
          </span>{' '}
          — Azure had no specialized model for this file. Raw text is shown below;
          please verify manually.
        </div>
      )}

      {doc.summary.textPreview && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary">
            Raw OCR text (first 2,000 chars)
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-low p-3 text-[11px] leading-relaxed text-on-surface-variant">
            {doc.summary.textPreview}
          </pre>
        </details>
      )}

      {doc.summary.azureModelId && (
        <div className="mt-2 text-[10px] uppercase tracking-widest text-on-surface-variant/60">
          Model: {doc.summary.azureModelId}
          {doc.summary.docType ? ` · docType: ${doc.summary.docType}` : ''}
        </div>
      )}

      {doc.signedUrl && (
        <div className="mt-4 flex justify-end">
          <a
            href={doc.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-low px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
            Open document
          </a>
        </div>
      )}
    </div>
  )
}

function ExtractionChip({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" strokeWidth={1.8} />
        Extracted
      </Badge>
    )
  }
  if (status === 'in_progress')
    return (
      <Badge variant="outline">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" strokeWidth={1.8} />
        Running
      </Badge>
    )
  if (status === 'failed')
    return (
      <Badge variant="destructive">
        <AlertTriangle className="mr-1 h-3 w-3" strokeWidth={1.8} />
        Failed
      </Badge>
    )
  return (
    <Badge variant="outline">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" strokeWidth={1.8} />
      Queued
    </Badge>
  )
}

export type { InspectorDoc }
