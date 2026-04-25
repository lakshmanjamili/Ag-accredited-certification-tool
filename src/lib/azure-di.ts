/**
 * Azure Document Intelligence client — raw fetch, no SDK.
 *
 * Flow:
 *   1. POST /documentModels/{modelId}:analyze  → 202 + Operation-Location
 *   2. Poll the Operation-Location URL until status is "succeeded" | "failed"
 *   3. Return the analyzeResult with documents[].fields
 *
 * On failure of a specialized tax model, we fall back to `prebuilt-layout`
 * so the CPA still gets raw extracted text + page/line data.
 *
 * No LLM is involved anywhere. Every number on the CPA's screen comes from
 * Azure's structured extractor.
 */

export const AZURE_MODELS = {
  // Tax forms — most specific first so routing picks the right one
  form_1040: 'prebuilt-tax.us.1040',
  w2: 'prebuilt-tax.us.w2',
  paystub: 'prebuilt-payStub.us',
  '1099_nec': 'prebuilt-tax.us.1099NEC',
  '1099_int': 'prebuilt-tax.us.1099Int',
  '1099_div': 'prebuilt-tax.us.1099Div',
  '1099_misc': 'prebuilt-tax.us.1099MISC',
  '1099_r': 'prebuilt-tax.us.1099R',
  '1099_k': 'prebuilt-tax.us.1099K',
  '1099_b': 'prebuilt-tax.us.1099B',
  '1098_e': 'prebuilt-tax.us.1098E',
  '1098_t': 'prebuilt-tax.us.1098T',
  // Financial statements (v4 API naming)
  bank_statement: 'prebuilt-bankStatement.us',
  // Fallbacks
  invoice: 'prebuilt-invoice',
  layout: 'prebuilt-layout',
} as const

export type AzureModelId = (typeof AZURE_MODELS)[keyof typeof AZURE_MODELS]

export type FieldValue =
  | { kind: 'string'; value: string; confidence: number | null }
  | { kind: 'number'; value: number; confidence: number | null }
  | { kind: 'currency'; cents: number; currency: string; confidence: number | null }
  | { kind: 'date'; value: string; confidence: number | null }
  | { kind: 'integer'; value: number; confidence: number | null }
  | { kind: 'address'; value: string; confidence: number | null }
  | { kind: 'array'; items: FieldValue[]; confidence: number | null }
  | { kind: 'object'; fields: Record<string, FieldValue>; confidence: number | null }
  | { kind: 'text'; value: string; confidence: number | null }

export type DocumentAnalysis = {
  modelUsed: AzureModelId
  fallbackUsed: boolean
  docType?: string
  confidence: number | null
  fields: Record<string, FieldValue>
  /** Raw concatenated text content from Azure — used for layout-fallback display */
  rawText: string | null
  pageCount: number | null
  /** Non-fatal error message if extraction partially failed */
  error?: string
}

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 45 // 90 seconds max
const API_VERSION = process.env.AZURE_DOCINTEL_API_VERSION ?? '2024-02-29-preview'

export async function analyzeDocument(
  preferredModel: AzureModelId,
  fileBuffer: ArrayBuffer,
  contentType = 'application/octet-stream',
): Promise<DocumentAnalysis> {
  // Try the specialized model first
  try {
    const result = await runAnalysis(preferredModel, fileBuffer, contentType)
    return normalize(result, preferredModel, false)
  } catch (err) {
    if (preferredModel === AZURE_MODELS.layout) throw err
    console.info(
      `[azure-di] ${preferredModel} failed, falling back to prebuilt-layout:`,
      err instanceof Error ? err.message : err,
    )
    // Fallback: raw layout extraction
    try {
      const fallback = await runAnalysis(AZURE_MODELS.layout, fileBuffer, contentType)
      const a = normalize(fallback, AZURE_MODELS.layout, true)
      a.error = err instanceof Error ? err.message : String(err)
      return a
    } catch (fallbackErr) {
      return {
        modelUsed: preferredModel,
        fallbackUsed: true,
        confidence: null,
        fields: {},
        rawText: null,
        pageCount: null,
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
      }
    }
  }
}

// ─── Low-level request + polling ───────────────────────────────────────

async function runAnalysis(
  modelId: AzureModelId,
  fileBuffer: ArrayBuffer,
  contentType: string,
): Promise<AnalyzeResult> {
  // Accept both AgFinTax planning-ai naming (AZURE_DOCINTEL_*) and our own (AZURE_DI_*).
  const endpoint = process.env.AZURE_DI_ENDPOINT || process.env.AZURE_DOCINTEL_ENDPOINT
  const key = process.env.AZURE_DI_KEY || process.env.AZURE_DOCINTEL_KEY
  if (!endpoint || !key) {
    throw new Error(
      'Azure DI credentials missing. Set AZURE_DI_ENDPOINT + AZURE_DI_KEY (or AZURE_DOCINTEL_*).',
    )
  }

  const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
  const analyzeUrl = `${baseUrl}/documentintelligence/documentModels/${modelId}:analyze?api-version=${API_VERSION}`

  const submit = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': contentType,
    },
    body: new Uint8Array(fileBuffer),
  })

  if (!submit.ok) {
    const text = await submit.text().catch(() => '')
    throw new Error(`Azure DI ${submit.status}: ${text.slice(0, 400)}`)
  }

  const operationLocation = submit.headers.get('operation-location')
  if (!operationLocation) throw new Error('No operation-location header')

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS)
    const poll = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    })
    if (!poll.ok) {
      const text = await poll.text().catch(() => '')
      throw new Error(`Poll ${poll.status}: ${text.slice(0, 200)}`)
    }
    const body = (await poll.json()) as {
      status: 'notStarted' | 'running' | 'succeeded' | 'failed'
      analyzeResult?: AnalyzeResult
      error?: { message?: string }
    }
    if (body.status === 'succeeded' && body.analyzeResult) return body.analyzeResult
    if (body.status === 'failed') {
      throw new Error(body.error?.message ?? 'Azure DI analysis failed')
    }
  }
  throw new Error('Azure DI polling timed out')
}

// ─── Normalize raw Azure result into our DocumentAnalysis shape ────────

type AnalyzeResult = {
  content?: string
  pages?: Array<{ pageNumber?: number }>
  documents?: Array<{
    docType?: string
    confidence?: number
    fields?: Record<string, RawField>
  }>
}

type RawField = {
  type?: string
  valueString?: string
  valueNumber?: number
  valueCurrency?: { amount: number; currencySymbol?: string; currencyCode?: string }
  valueDate?: string
  valueInteger?: number
  valueAddress?: {
    streetAddress?: string
    city?: string
    state?: string
    postalCode?: string
    countryRegion?: string
  }
  valueArray?: RawField[]
  valueObject?: Record<string, RawField>
  content?: string
  confidence?: number
}

function normalize(
  result: AnalyzeResult,
  modelUsed: AzureModelId,
  fallbackUsed: boolean,
): DocumentAnalysis {
  const doc = result.documents?.[0]
  const fields: Record<string, FieldValue> = {}
  if (doc?.fields) {
    for (const [name, raw] of Object.entries(doc.fields)) {
      const v = fieldValue(raw)
      if (v) fields[name] = v
    }
  }
  return {
    modelUsed,
    fallbackUsed,
    docType: doc?.docType,
    confidence: typeof doc?.confidence === 'number' ? doc.confidence : null,
    fields,
    rawText: result.content ?? null,
    pageCount: result.pages?.length ?? null,
  }
}

function fieldValue(raw: RawField | undefined): FieldValue | null {
  if (!raw) return null
  const confidence = typeof raw.confidence === 'number' ? raw.confidence : null
  if (raw.valueString != null)
    return { kind: 'string', value: raw.valueString, confidence }
  if (typeof raw.valueNumber === 'number')
    return { kind: 'number', value: raw.valueNumber, confidence }
  if (raw.valueCurrency && typeof raw.valueCurrency.amount === 'number')
    return {
      kind: 'currency',
      cents: Math.round(raw.valueCurrency.amount * 100),
      currency: raw.valueCurrency.currencyCode ?? 'USD',
      confidence,
    }
  if (raw.valueDate) return { kind: 'date', value: raw.valueDate, confidence }
  if (typeof raw.valueInteger === 'number')
    return { kind: 'integer', value: raw.valueInteger, confidence }
  if (raw.valueAddress) {
    const parts = [
      raw.valueAddress.streetAddress,
      raw.valueAddress.city,
      raw.valueAddress.state,
      raw.valueAddress.postalCode,
      raw.valueAddress.countryRegion,
    ].filter(Boolean)
    return { kind: 'address', value: parts.join(', '), confidence }
  }
  if (raw.valueArray)
    return {
      kind: 'array',
      items: raw.valueArray.map(fieldValue).filter((x): x is FieldValue => x != null),
      confidence,
    }
  if (raw.valueObject) {
    const inner: Record<string, FieldValue> = {}
    for (const [k, v] of Object.entries(raw.valueObject)) {
      const fv = fieldValue(v)
      if (fv) inner[k] = fv
    }
    return { kind: 'object', fields: inner, confidence }
  }
  if (raw.content) return { kind: 'text', value: raw.content, confidence }
  return null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Helpers for callers ───────────────────────────────────────────────

export function fieldToCents(f: FieldValue | undefined): number | null {
  if (!f) return null
  if (f.kind === 'currency') return f.cents
  if (f.kind === 'number') return Math.round(f.value * 100)
  if (f.kind === 'integer') return Math.round(f.value * 100)
  if (f.kind === 'string' || f.kind === 'text') {
    const num = Number(f.value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(num) ? Math.round(num * 100) : null
  }
  return null
}

export function fieldToString(f: FieldValue | undefined): string | null {
  if (!f) return null
  if (f.kind === 'string' || f.kind === 'text' || f.kind === 'date' || f.kind === 'address')
    return f.value
  if (f.kind === 'number' || f.kind === 'integer') return String(f.value)
  if (f.kind === 'currency')
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: f.currency,
    }).format(f.cents / 100)
  return null
}

export function fieldToNumber(f: FieldValue | undefined): number | null {
  if (!f) return null
  if (f.kind === 'number') return f.value
  if (f.kind === 'integer') return f.value
  if (f.kind === 'string' || f.kind === 'text') {
    const n = Number(f.value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Mask SSN-like patterns (XXX-XX-XXXX) in a string before display.
 */
export function maskPII(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/\b(\d{3}|\*{3})[- ]?\d{2}[- ]?\d{4}\b/g, '***-**-****')
}
