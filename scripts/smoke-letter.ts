/**
 * Smoke-test the DOCX letter generator with fake extracted data — verifies
 * the reference-letter output end-to-end (template → placeholders → checkbox
 * toggle → output DOCX).
 *
 * Run: `npx tsx scripts/smoke-letter.ts`
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildCertificateDocx } from '../src/lib/letter-docx'

const outDir = path.join(process.cwd(), 'docs', 'smoke-out')
fs.mkdirSync(outDir, { recursive: true })

const now = new Date()
const valid = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

const cases = [
  {
    label: 'joint-income',
    data: {
      investorName: 'John & Jane Doe',
      investorAddressLine1: '8195 CUSTER RD',
      investorAddressLine2: 'FRISCO, TX 75035',
      taxYearPrimary: 2024,
      taxYearSecondary: 2023,
      path: 'income' as const,
      certificateNumber: 'AG-2026-DOE',
      issuedAt: now,
      validThrough: valid,
    },
  },
  {
    label: 'solo-networth',
    data: {
      investorName: 'Alex Kumar',
      investorAddressLine1: '1 Infinite Loop',
      investorAddressLine2: 'Cupertino, CA 95014',
      taxYearPrimary: 2024,
      taxYearSecondary: 2023,
      path: 'net_worth' as const,
      certificateNumber: 'AG-2026-KUM',
      issuedAt: now,
      validThrough: valid,
    },
  },
  {
    label: 'entity',
    data: {
      investorName: 'Magnolia Holdings LLC',
      investorAddressLine1: '5200 Legacy Dr',
      investorAddressLine2: 'Plano, TX 75024',
      taxYearPrimary: null,
      taxYearSecondary: null,
      path: 'entity_assets' as const,
      certificateNumber: 'AG-2026-MAG',
      issuedAt: now,
      validThrough: valid,
    },
  },
]

for (const { label, data } of cases) {
  try {
    const buf = buildCertificateDocx(data)
    const outPath = path.join(outDir, `${data.certificateNumber}_${label}.docx`)
    fs.writeFileSync(outPath, buf)
    console.info(`✓ ${label.padEnd(18)} → ${path.relative(process.cwd(), outPath)} (${buf.byteLength} bytes)`)
  } catch (err) {
    console.error(`✗ ${label}:`, err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}
