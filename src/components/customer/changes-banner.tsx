import { AlertCircle } from 'lucide-react'

export function ChangesBanner({
  note,
  requestedAt,
  cpaName,
}: {
  note: string | null
  requestedAt: Date | null
  cpaName: string | null
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-navy-gradient p-6 text-white shadow-ghost">
      <div className="absolute -right-8 -top-8 opacity-10">
        <AlertCircle className="h-40 w-40" strokeWidth={1.2} />
      </div>
      <div className="relative">
        <div className="mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-secondary" />
          <div className="text-xs font-bold uppercase tracking-widest text-secondary">
            CPA requested changes
          </div>
        </div>
        <h3 className="font-serif text-2xl italic">Here&apos;s what your reviewer said.</h3>
        {note ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{note}</p>
        ) : (
          <p className="mt-3 text-sm text-white/70 italic">No specific note was left.</p>
        )}
        <div className="mt-4 text-[11px] uppercase tracking-widest text-white/50">
          {cpaName ? `${cpaName} · ` : ''}
          {requestedAt
            ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                requestedAt,
              )
            : ''}
        </div>
        <p className="mt-4 text-sm text-white/70">
          Upload the requested documents below, then click{' '}
          <strong className="text-white">Resubmit for review</strong>.
        </p>
      </div>
    </div>
  )
}
