import { CheckCircle2, AlertTriangle, Circle, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { VerificationPlan, RequirementSlot } from '@/lib/verify-requirements'

export function VerifyChecklist({ plan }: { plan: VerificationPlan }) {
  return (
    <div className="rounded-2xl bg-surface-lowest p-6 shadow-ghost">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-primary">What we need</h3>
        <Badge variant={plan.ready ? 'success' : 'outline'}>
          {plan.completion.filled} of {plan.completion.total}
        </Badge>
      </div>
      <p className="mb-6 text-xs uppercase tracking-widest text-on-surface-variant">
        {plan.summary}
      </p>

      <ol className="space-y-4">
        {plan.slots.map((slot) => (
          <ChecklistRow key={slot.key} slot={slot} />
        ))}
      </ol>

      {plan.unassignedDocs.length > 0 && (
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="smallcaps mb-2 text-[10px] font-bold tracking-[.18em] text-slate-500">
            Extra uploads ({plan.unassignedDocs.length})
          </p>
          <ul className="space-y-1">
            {plan.unassignedDocs.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs text-slate-600">
                <FileText className="h-3 w-3" strokeWidth={1.8} />
                <span className="truncate">{d.fileName}</span>
                <span className="text-slate-400">· {d.type.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            These are extra files beyond the required checklist. Your CPA can still review them
            during approval.
          </p>
        </div>
      )}
    </div>
  )
}

function ChecklistRow({ slot }: { slot: RequirementSlot }) {
  const icon =
    slot.status === 'uploaded_matched' ? (
      <CheckCircle2 className="h-5 w-5 text-[var(--success)]" strokeWidth={1.8} />
    ) : slot.status === 'uploaded_mismatch' ? (
      <AlertTriangle className="h-5 w-5 text-secondary" strokeWidth={1.8} />
    ) : slot.status === 'uploaded_pending' ? (
      <AlertTriangle className="h-5 w-5 text-secondary" strokeWidth={1.8} />
    ) : (
      <Circle className="h-5 w-5 text-on-surface-variant/40" strokeWidth={1.5} />
    )

  return (
    <li className="flex gap-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-on-surface">{slot.title}</h4>
          {slot.status === 'uploaded_matched' && <Badge variant="success">Complete</Badge>}
          {slot.status === 'uploaded_mismatch' && <Badge variant="warning">Year mismatch</Badge>}
          {slot.status === 'uploaded_pending' && <Badge variant="outline">Needs more</Badge>}
          {slot.status === 'missing' && <Badge variant="outline">Missing</Badge>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{slot.description}</p>
        {slot.note && (
          <p
            className={`mt-1 text-xs ${
              slot.severity === 'warning' || slot.severity === 'error'
                ? 'text-secondary'
                : 'text-on-surface-variant/70'
            }`}
          >
            {slot.note}
          </p>
        )}
        {slot.fulfilledBy.length > 0 && (
          <ul className="mt-2 space-y-1">
            {slot.fulfilledBy.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded-md bg-surface-low px-2 py-1 text-xs"
              >
                <FileText className="h-3 w-3 text-primary" />
                <span className="truncate font-medium">{d.fileName}</span>
                <span className="ml-auto text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {d.extractionStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
