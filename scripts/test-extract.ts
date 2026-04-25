/**
 * End-to-end Azure Document Intelligence extraction test.
 *
 * Usage:
 *   npm run test:extract -- <path-to-pdf> [docType]
 *
 * docType defaults to `form_1040`. Supported: form_1040, w2, paystub,
 * bank_statement, brokerage_statement, retirement_statement, other.
 */

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { extractDocument } from '../src/lib/extraction'
import { evaluate } from '../src/lib/sec-verify'

const filePath = process.argv[2]
const docType = (process.argv[3] ?? 'form_1040') as
  | 'form_1040'
  | 'w2'
  | 'paystub'
  | 'bank_statement'
  | 'brokerage_statement'
  | 'retirement_statement'
  | 'other'

if (!filePath) {
  console.error('Usage: npm run test:extract -- <path-to-pdf> [docType]')
  process.exit(1)
}

const absPath = path.resolve(filePath)
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`)
  process.exit(1)
}

async function main() {
  const buffer = fs.readFileSync(absPath)
  console.info(`\nFile:    ${absPath}`)
  console.info(`Size:    ${(buffer.length / 1024).toFixed(1)} KB`)
  console.info(`DocType: ${docType}`)
  console.info(`Azure:   ${process.env.AZURE_DI_ENDPOINT || '(missing)'}`)
  console.info('')
  console.info('Calling Azure DI — this takes 10-45s…')

  const t0 = Date.now()
  const result = await extractDocument(
    docType,
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  )
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)

  console.info('')
  console.info('─── RESULT ───────────────────────────────────────────')
  console.info(`Model used:      ${result.modelUsed}`)
  console.info(`Fallback used:   ${result.fallbackUsed}`)
  console.info(`Detected type:   ${result.docType ?? '(none)'}`)
  console.info(`Confidence:      ${result.confidence != null ? (result.confidence * 100).toFixed(0) + '%' : '—'}`)
  console.info(`Pages:           ${result.pageCount ?? '—'}`)
  console.info(`Elapsed:         ${elapsed}s`)
  if (result.error) console.info(`⚠ Error:         ${result.error}`)
  console.info('')

  console.info('─── KEY VALUES (for sec-verify) ──────────────────────')
  for (const [k, v] of Object.entries(result.keyValues)) {
    if (v == null) continue
    const display = typeof v === 'number' && k.endsWith('Cents')
      ? `$${(v / 100).toLocaleString('en-US')}`
      : String(v)
    console.info(`  ${pad(k, 28)} ${display}`)
  }
  console.info('')

  console.info(`─── DISPLAY FIELDS (${result.displayFields.length}) ───────────────────────`)
  for (const f of result.displayFields.slice(0, 25)) {
    const conf =
      f.confidence != null ? ` [${(f.confidence * 100).toFixed(0)}%]` : ''
    const val = (f.value ?? '').toString().slice(0, 60)
    const mark = f.highlight ? '★' : ' '
    console.info(`  ${mark} ${pad(f.label, 32)} ${val}${conf}`)
  }
  if (result.displayFields.length > 25) {
    console.info(`  … ${result.displayFields.length - 25} more fields`)
  }

  console.info('')
  if (result.rawTextPreview) {
    console.info('─── RAW TEXT PREVIEW (first 500 chars) ───────────────')
    console.info(result.rawTextPreview.slice(0, 500))
    console.info('')
  }

  // If this is a 1040, run a simulated rule evaluation
  if (docType === 'form_1040' && typeof result.keyValues.agiCents === 'number') {
    console.info('─── SIMULATED RULE EVALUATION (MFJ, $300k threshold) ──')
    const agi = result.keyValues.agiCents as number
    const evaluation = evaluate({
      path: 'income',
      filingStatus: 'mfj',
      year1AgiCents: agi, // pretend this is Y1
      year2AgiCents: agi, // pretend this is Y2
      year3PayStubAnnualizedCents: agi, // pretend current-year
      year3W2Cents: null,
      avgConfidence: result.confidence,
    })
    console.info(`Preliminary:     ${evaluation.status.toUpperCase()}`)
    console.info(`Threshold:       $${(evaluation.threshold / 100).toLocaleString('en-US')}`)
    console.info(`AGI used:        $${(agi / 100).toLocaleString('en-US')}`)
    for (const r of evaluation.reasons) {
      console.info(`  · [${r.severity}] ${r.code}: ${r.message}`)
    }
  }

  console.info('')
}

function pad(s: string, n: number) {
  return (s + ' '.repeat(n)).slice(0, n)
}

main().catch((err) => {
  console.error('')
  console.error('❌ Test failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
