/**
 * AI-assisted eligibility summary for the CPA review screen.
 *
 * Uses OpenRouter (any LLM) to turn the structured extraction output +
 * sec-verify rule evaluation into a plain-English, 3–5 sentence summary
 * the CPA can skim. Azure DI still does all number extraction; the LLM
 * ONLY drafts narrative + flags specific things for CPA attention.
 *
 * If OPENROUTER_API_KEY isn't set, returns a deterministic fallback built
 * from the extracted data — no network call. Never blocks the page.
 */

import type { AggregatedInputs, ExtractedSummary } from '@/lib/aggregate-extraction'
import type { VerificationResult } from '@/lib/sec-verify'

export type EligibilitySummary = {
  verdict: 'likely_eligible' | 'likely_ineligible' | 'needs_cpa_review'
  headline: string
  paragraph: string
  attentionPoints: string[]
  sourceModel: string // e.g., "anthropic/claude-sonnet-4-5" or "deterministic-fallback"
  generatedAt: string
}

const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'

type SummaryContext = {
  path: 'income' | 'net_worth' | 'professional' | 'entity_assets' | null
  filingStatus: string | null
  aggregated: AggregatedInputs
  ruleEvaluation: VerificationResult | null
  submittedAt: Date | null
}

export async function generateEligibilitySummary(
  ctx: SummaryContext,
): Promise<EligibilitySummary> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const prompt = buildPrompt(ctx)

  if (!apiKey) {
    return deterministicFallback(ctx)
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? '',
        'X-Title': 'AgFinTax Certification',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a licensed CPA reviewing an accredited-investor verification submission.
You NEVER perform math yourself — all numbers are pre-extracted. You write a concise
2–4 sentence narrative summary followed by 1–4 specific items for CPA attention.
Be decisive: state whether the applicant is LIKELY ELIGIBLE, LIKELY INELIGIBLE, or NEEDS CPA REVIEW.
Respond ONLY with a JSON object matching this schema exactly:
{
  "verdict": "likely_eligible" | "likely_ineligible" | "needs_cpa_review",
  "headline": "a single sentence, 8–16 words",
  "paragraph": "2–4 sentences explaining the reasoning based on the evidence",
  "attentionPoints": ["1–4 short items the reviewing CPA should specifically verify"]
}
Do not include markdown fences. Do not include any text outside the JSON.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(
        `[eligibility-summary] OpenRouter ${res.status}: ${body.slice(0, 200)}`,
      )
      return deterministicFallback(ctx)
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = json.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(raw) as {
      verdict?: string
      headline?: string
      paragraph?: string
      attentionPoints?: string[]
    }

    return {
      verdict:
        parsed.verdict === 'likely_eligible' ||
        parsed.verdict === 'likely_ineligible' ||
        parsed.verdict === 'needs_cpa_review'
          ? parsed.verdict
          : 'needs_cpa_review',
      headline: parsed.headline ?? deterministicFallback(ctx).headline,
      paragraph: parsed.paragraph ?? deterministicFallback(ctx).paragraph,
      attentionPoints: Array.isArray(parsed.attentionPoints)
        ? parsed.attentionPoints.slice(0, 4)
        : [],
      sourceModel: DEFAULT_MODEL,
      generatedAt: new Date().toISOString(),
    }
  } catch (err) {
    console.warn(
      '[eligibility-summary] falling back to deterministic:',
      err instanceof Error ? err.message : err,
    )
    return deterministicFallback(ctx)
  }
}

function buildPrompt(ctx: SummaryContext): string {
  const lines: string[] = []

  lines.push(`Verification path: ${ctx.path ?? 'unknown'}`)
  if (ctx.filingStatus) lines.push(`Filing status: ${ctx.filingStatus}`)
  if (ctx.submittedAt)
    lines.push(`Submitted: ${ctx.submittedAt.toISOString()}`)

  lines.push('')
  lines.push('Extracted documents:')
  for (const s of ctx.aggregated.summaries) {
    lines.push(
      `- ${s.fileName} (${s.type}${
        s.taxYear ? `, year ${s.taxYear}` : ''
      }, confidence ${s.confidence != null ? (s.confidence * 100).toFixed(0) + '%' : 'n/a'}):`,
    )
    for (const f of s.fields.slice(0, 8)) {
      lines.push(`    ${f.label}: ${f.value}`)
    }
  }

  if (ctx.ruleEvaluation) {
    lines.push('')
    lines.push('Rule engine output:')
    lines.push(`  status: ${ctx.ruleEvaluation.status}`)
    lines.push(
      `  threshold: $${(ctx.ruleEvaluation.threshold / 100).toLocaleString('en-US')}`,
    )
    if (ctx.ruleEvaluation.computed.incomeY1 != null)
      lines.push(
        `  year1 AGI: $${(ctx.ruleEvaluation.computed.incomeY1 / 100).toLocaleString('en-US')}`,
      )
    if (ctx.ruleEvaluation.computed.incomeY2 != null)
      lines.push(
        `  year2 AGI: $${(ctx.ruleEvaluation.computed.incomeY2 / 100).toLocaleString('en-US')}`,
      )
    if (ctx.ruleEvaluation.computed.incomeY3Est != null)
      lines.push(
        `  current-year est: $${(ctx.ruleEvaluation.computed.incomeY3Est / 100).toLocaleString('en-US')}`,
      )
    lines.push(`  reasons:`)
    for (const r of ctx.ruleEvaluation.reasons) {
      lines.push(`    - [${r.severity}] ${r.code}: ${r.message}`)
    }
  }

  return lines.join('\n')
}

function deterministicFallback(ctx: SummaryContext): EligibilitySummary {
  const r = ctx.ruleEvaluation
  const verdict: EligibilitySummary['verdict'] =
    r?.status === 'approved'
      ? 'likely_eligible'
      : r?.status === 'rejected'
      ? 'likely_ineligible'
      : 'needs_cpa_review'

  const headline =
    verdict === 'likely_eligible'
      ? 'Numbers meet the threshold — ready for CPA sign-off.'
      : verdict === 'likely_ineligible'
      ? "Evidence doesn't meet the SEC threshold on this path."
      : 'Manual CPA review required.'

  const lowConfidenceDocs = ctx.aggregated.summaries.filter(
    (s: ExtractedSummary) => (s.confidence ?? 1) < 0.7,
  )
  const missingAzureFields = ctx.aggregated.summaries.filter(
    (s: ExtractedSummary) => s.extractionStatus === 'done' && s.fields.length === 0,
  )

  const paragraph =
    r?.status === 'approved'
      ? `All ${ctx.path === 'income' ? 'three years of income evidence' : 'required evidence'} clears the threshold. ${
          r.avgConfidence != null
            ? `Azure Document Intelligence extracted with an average confidence of ${(r.avgConfidence * 100).toFixed(0)}%.`
            : ''
        } CPA should verify the numbers match the original documents before signing.`
      : r?.status === 'rejected'
      ? `The extracted values fall below the SEC Rule 501(a) threshold for this path. ${r.reasons[0]?.message ?? ''}`
      : 'One or more required evidence items are missing, incomplete, or low-confidence. CPA judgment required before a decision.'

  const attentionPoints: string[] = []
  if (lowConfidenceDocs.length > 0) {
    attentionPoints.push(
      `${lowConfidenceDocs.length} document(s) extracted below 70% confidence — verify manually.`,
    )
  }
  if (missingAzureFields.length > 0) {
    attentionPoints.push(
      `${missingAzureFields.length} document(s) returned no key values — Azure fell back to layout OCR.`,
    )
  }
  for (const reason of (r?.reasons ?? []).filter(
    (x) => x.severity !== 'info',
  )) {
    attentionPoints.push(reason.message)
  }

  return {
    verdict,
    headline,
    paragraph,
    attentionPoints: attentionPoints.slice(0, 4),
    sourceModel: 'deterministic-fallback',
    generatedAt: new Date().toISOString(),
  }
}
