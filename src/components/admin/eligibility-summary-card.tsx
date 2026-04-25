import { Sparkles, CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react'
import type { EligibilitySummary } from '@/lib/eligibility-summary'

/**
 * Inline "AI-assisted eligibility summary" card on the admin review screen.
 * Pulls straight from the LLM (or deterministic fallback) output.
 * Sits next to the rule evaluation as the CPA's first-read overview.
 */
export function EligibilitySummaryCard({ summary }: { summary: EligibilitySummary }) {
  const tone = summary.verdict === 'likely_eligible'
    ? {
        border: 'border-[var(--success)]/30',
        bg: 'bg-[var(--success-50)]',
        label: 'Likely eligible',
        icon: <CheckCircle2 className="h-4 w-4" strokeWidth={2} />,
        color: 'text-[var(--success)]',
      }
    : summary.verdict === 'likely_ineligible'
    ? {
        border: 'border-[var(--danger)]/30',
        bg: 'bg-[var(--danger-50)]',
        label: 'Likely ineligible',
        icon: <XCircle className="h-4 w-4" strokeWidth={2} />,
        color: 'text-[var(--danger)]',
      }
    : {
        border: 'border-[var(--warn)]/30',
        bg: 'bg-[var(--warn-50)]',
        label: 'Needs CPA review',
        icon: <AlertCircle className="h-4 w-4" strokeWidth={2} />,
        color: 'text-[var(--warn)]',
      }

  const isAI = summary.sourceModel !== 'deterministic-fallback'

  return (
    <div
      className={`rounded-[10px] border ${tone.border} bg-paper p-5 elev`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full ${tone.bg} ${tone.color}`}
          >
            {tone.icon}
          </div>
          <div>
            <div className="smallcaps text-[10px] tracking-[.18em] text-slate-500">
              AI eligibility summary
            </div>
            <div className={`text-[12px] font-bold ${tone.color}`}>{tone.label}</div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-50)] px-2 py-0.5 text-[9.5px] font-semibold text-[#8E6F10]"
          title={`Source: ${summary.sourceModel}`}
        >
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          {isAI ? 'LLM-assisted' : 'Rule-based'}
        </span>
      </div>

      <h3
        className="font-serif text-[16px] leading-snug text-ink"
        style={{ fontWeight: 600 }}
      >
        {summary.headline}
      </h3>

      <p className="mt-2 text-[12.5px] leading-[1.7] text-slate-600">
        {summary.paragraph}
      </p>

      {summary.attentionPoints.length > 0 && (
        <div className="mt-4 rounded-[6px] bg-bone p-3">
          <div className="smallcaps mb-1.5 text-[9.5px] tracking-[.18em] text-slate-500">
            Please verify
          </div>
          <ul className="space-y-1.5">
            {summary.attentionPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-slate-700">
                <Info
                  className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warn)]"
                  strokeWidth={2}
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 text-[9.5px] text-slate-400">
        {isAI
          ? 'All numbers come from Azure Document Intelligence. Narrative drafted by LLM — CPA makes the final decision.'
          : 'Deterministic summary from extracted fields + sec-verify. Set OPENROUTER_API_KEY for LLM-assisted narrative.'}
      </div>
    </div>
  )
}
