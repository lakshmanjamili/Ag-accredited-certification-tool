/**
 * Smoke-test the new AG FinTax letter-pdf generator. Produces 3 sample
 * PDFs under docs/smoke-out — one for each verification path.
 *
 * Run: `npx tsx scripts/smoke-pdf.ts`
 */

import fs from 'node:fs'
import path from 'node:path'
import { buildLetterPdf } from '../src/lib/letter-pdf'

const outDir = path.join(process.cwd(), 'docs', 'smoke-out')
fs.mkdirSync(outDir, { recursive: true })

// Tiny 1x1 transparent PNG so the embed path exercises
const blankPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64',
)

const now = new Date()
const valid = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

const cases = [
  {
    label: 'joint-income',
    data: {
      certificateNumber: 'AG-2026-DOE',
      path: 'income' as const,
      investorName: 'John & Jane Doe',
      investorAddressLine1: '8195 CUSTER RD',
      investorAddressLine2: 'FRISCO, TX 75035',
      taxYearPrimary: 2025,
      taxYearSecondary: 2024,
      issuedAt: now,
      validThrough: valid,
      cpa: {
        name: 'Anil Grandhi, CPA',
        license: 'TX-012345',
        title: 'CPA · Managing Partner',
        firm: 'AG FINTAX, LLC',
        firmCity: 'Frisco, TX',
        firmEmail: 'anil@agfintax.com',
        jurisdiction: 'Texas',
      },
      signaturePng: blankPng,
    },
  },
  {
    label: 'solo-networth',
    data: {
      certificateNumber: 'AG-2026-KUM',
      path: 'net_worth' as const,
      investorName: 'Alex Kumar',
      investorAddressLine1: '1 Infinite Loop',
      investorAddressLine2: 'Cupertino, CA 95014',
      taxYearPrimary: 2025,
      taxYearSecondary: 2024,
      issuedAt: now,
      validThrough: valid,
      cpa: {
        name: 'Anil Grandhi, CPA',
        license: 'TX-012345',
        title: 'CPA',
        firm: 'AG FINTAX, LLC',
        firmCity: 'Frisco, TX',
        firmEmail: 'anil@agfintax.com',
        jurisdiction: 'Texas',
      },
      signaturePng: blankPng,
    },
  },
  {
    label: 'entity-assets',
    data: {
      certificateNumber: 'AG-2026-MAG',
      path: 'entity_assets' as const,
      investorName: 'Magnolia Holdings LLC',
      investorAddressLine1: '5200 Legacy Dr',
      investorAddressLine2: 'Plano, TX 75024',
      taxYearPrimary: null,
      taxYearSecondary: null,
      issuedAt: now,
      validThrough: valid,
      cpa: {
        name: 'Anil Grandhi, CPA',
        license: 'TX-012345',
        title: 'CPA',
        firm: 'AG FINTAX, LLC',
        firmCity: 'Frisco, TX',
        firmEmail: 'anil@agfintax.com',
        jurisdiction: 'Texas',
      },
      signaturePng: blankPng,
    },
  },
]

async function main() {
  for (const { label, data } of cases) {
    try {
      const bytes = await buildLetterPdf(data)
      const outPath = path.join(outDir, `${data.certificateNumber}_${label}.pdf`)
      fs.writeFileSync(outPath, bytes)
      console.info(
        `✓ ${label.padEnd(18)} → ${path.relative(process.cwd(), outPath)} (${bytes.byteLength} bytes)`,
      )
    } catch (err) {
      console.error(`✗ ${label}:`, err instanceof Error ? err.message : err)
      process.exitCode = 1
    }
  }
}

void main()
