import { FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { InspectorDoc } from './document-inspector'

/**
 * Compact list of all docs + their key extracted values. Sits to the right
 * of the PDF viewer on the CPA review page.
 */
export function ExtractedFieldsCard({ docs }: { docs: InspectorDoc[] }) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-paper p-5 elev">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
            Extracted values
          </div>
          <h3 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            What Azure saw in each document
          </h3>
        </div>
      </div>

      <ul className="space-y-3">
        {docs.map((d) => {
          const highlights = d.summary.fields.filter((f) => f.highlight).slice(0, 6)
          const conf = d.summary.confidence
          return (
            <li
              key={d.id}
              className="rounded-[8px] border border-slate-200 bg-bone p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-ink" strokeWidth={1.8} />
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-slate-900">
                      {d.fileName}
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      {d.type.replace('_', ' ')}
                      {conf != null && ` · ${(conf * 100).toFixed(0)}% confidence`}
                    </div>
                  </div>
                </div>
                {d.summary.extractionStatus === 'done' ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-[var(--success)]"
                    strokeWidth={2}
                  />
                ) : d.summary.extractionStatus === 'failed' ? (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-destructive"
                    strokeWidth={2}
                  />
                ) : (
                  <span className="smallcaps text-[9px] tracking-[.18em] text-slate-500">
                    Queued
                  </span>
                )}
              </div>

              {highlights.length > 0 ? (
                <dl className="divide-y divide-slate-100 rounded-[6px] bg-paper">
                  {highlights.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-baseline justify-between gap-3 px-3 py-1.5"
                    >
                      <dt className="smallcaps text-[9.5px] tracking-[.16em] text-slate-500">
                        {f.label}
                      </dt>
                      <dd className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                        {f.value}
                        {f.confidence != null && (
                          <span
                            className={`ml-1.5 text-[9px] font-bold ${
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
              ) : d.summary.extractionStatus === 'done' ? (
                <div className="rounded-[6px] bg-[var(--warn-50)] px-3 py-1.5 text-[10.5px] text-[var(--warn)]">
                  Azure returned no key values — CPA should eyeball the document directly.
                </div>
              ) : (
                <div className="rounded-[6px] bg-slate-100 px-3 py-1.5 text-[10.5px] text-slate-500">
                  Waiting for extraction…
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
