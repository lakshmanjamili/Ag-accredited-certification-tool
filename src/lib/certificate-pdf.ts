/**
 * Builds a branded accredited-investor verification certificate as a PDF.
 * Uses pdf-lib so it runs in any Node or edge runtime without LibreOffice.
 *
 * Layout is drawn programmatically — no external PDF template needed.
 * Design matches the brand: navy header, gold accents, Plus-Jakarta-Sans-like
 * sans body (Helvetica fallback), CPA signature block, and QR-verify URL.
 */

import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import QRCode from 'qrcode'
import type { VerificationPath } from '@/lib/constants'
import { BRAND } from '@/lib/brand'

export type CertificateData = {
  certificateNumber: string
  path: VerificationPath
  issuedAt: Date
  validThrough: Date
  investorName: string
  investorAddressLine1: string
  investorAddressLine2: string
  filingStatus: string | null
  cpa: {
    name: string
    license: string
    title: string
    firm: string
    firmCity: string
    firmEmail: string
    typedSignatureBlock: string
  }
  signaturePng: Buffer | Uint8Array
}

const navy = hexToRgb(BRAND.primary)
const gold = hexToRgb(BRAND.secondary)
const text = rgb(0.11, 0.11, 0.09)
const muted = rgb(0.27, 0.28, 0.3)

export async function buildCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792]) // US Letter
  const { width, height } = page.getSize()

  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // ─── Header bar ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: navy })
  page.drawText(BRAND.name, {
    x: 48,
    y: height - 50,
    size: 22,
    font: helvBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('Accredited Investor Verification', {
    x: 48,
    y: height - 70,
    size: 10,
    font: helv,
    color: rgb(1, 1, 1, ),
  })
  page.drawText(`Certificate ${data.certificateNumber}`, {
    x: width - 48 - helv.widthOfTextAtSize(`Certificate ${data.certificateNumber}`, 10),
    y: height - 50,
    size: 10,
    font: helvBold,
    color: rgb(1, 1, 1),
  })

  // Orange rule
  page.drawRectangle({ x: 0, y: height - 84, width, height: 4, color: gold })

  // ─── Body ──────────────────────────────────────────────────────────
  let y = height - 130

  page.drawText('VERIFICATION STATEMENT', {
    x: 48,
    y,
    size: 9,
    font: helvBold,
    color: gold,
  })
  y -= 24

  page.drawText('This is to certify that', { x: 48, y, size: 11, font: helv, color: muted })
  y -= 28

  page.drawText(data.investorName.toUpperCase(), {
    x: 48,
    y,
    size: 20,
    font: helvBold,
    color: text,
  })
  y -= 18

  if (data.investorAddressLine1) {
    page.drawText(data.investorAddressLine1, { x: 48, y, size: 10, font: helv, color: muted })
    y -= 14
  }
  if (data.investorAddressLine2) {
    page.drawText(data.investorAddressLine2, { x: 48, y, size: 10, font: helv, color: muted })
    y -= 14
  }

  y -= 20
  const intro = wrap(
    'meets the definition of an "accredited investor" under SEC Rule 501(a) of Regulation D, based on documentation reviewed in connection with this engagement.',
    76,
  )
  for (const line of intro) {
    page.drawText(line, { x: 48, y, size: 11, font: helv, color: text })
    y -= 16
  }

  y -= 10

  const checkboxRows: { label: string; checked: boolean }[] = [
    { label: 'Individual income test — Rule 501(a)(6)', checked: isIndividualIncome(data) },
    { label: 'Joint income test — Rule 501(a)(6)', checked: isJointIncome(data) },
    { label: 'Net-worth test — Rule 501(a)(5)', checked: data.path === 'net_worth' },
    { label: 'Professional credential — Rule 501(a)', checked: data.path === 'professional' },
  ]
  for (const row of checkboxRows) {
    const box = 11
    page.drawRectangle({
      x: 60,
      y: y - box,
      width: box,
      height: box,
      borderColor: text,
      borderWidth: 1,
      color: row.checked ? navy : rgb(1, 1, 1),
    })
    if (row.checked) {
      page.drawText('X', {
        x: 62,
        y: y - box + 2,
        size: 9,
        font: helvBold,
        color: rgb(1, 1, 1),
      })
    }
    page.drawText(row.label, { x: 80, y: y - box + 1, size: 10, font: helv, color: text })
    y -= 18
  }

  y -= 12
  const assurance = wrap(
    'I have reviewed documentation substantiating the above within the 90 days prior to the date below and, based on my professional judgment as a Certified Public Accountant, attest to this verification.',
    76,
  )
  for (const line of assurance) {
    page.drawText(line, { x: 48, y, size: 10, font: helv, color: muted })
    y -= 14
  }

  // ─── Signature block ───────────────────────────────────────────────
  y -= 30
  const sigY = y - 60

  let sigImg: PDFImage | null = null
  try {
    sigImg = await pdf.embedPng(data.signaturePng)
  } catch {
    // Signature embedding failed — continue without image.
  }

  if (sigImg) {
    const sigDims = sigImg.scale(160 / Math.max(sigImg.width, 1))
    const drawH = Math.min(sigDims.height, 52)
    const drawW = sigDims.width * (drawH / sigDims.height)
    page.drawImage(sigImg, { x: 48, y: sigY, width: drawW, height: drawH })
  }

  page.drawLine({
    start: { x: 48, y: sigY - 6 },
    end: { x: 300, y: sigY - 6 },
    color: text,
    thickness: 0.75,
  })

  let cy = sigY - 22
  page.drawText(data.cpa.name, { x: 48, y: cy, size: 11, font: helvBold, color: text })
  cy -= 14
  if (data.cpa.title) {
    page.drawText(data.cpa.title, { x: 48, y: cy, size: 10, font: helv, color: muted })
    cy -= 13
  }
  if (data.cpa.license) {
    page.drawText(`License: ${data.cpa.license}`, { x: 48, y: cy, size: 9, font: helv, color: muted })
    cy -= 12
  }
  if (data.cpa.firm) {
    page.drawText(data.cpa.firm, { x: 48, y: cy, size: 9, font: helv, color: muted })
    cy -= 12
  }
  if (data.cpa.firmCity) {
    page.drawText(`${data.cpa.firmCity} · ${data.cpa.firmEmail}`, {
      x: 48,
      y: cy,
      size: 9,
      font: helv,
      color: muted,
    })
  }

  // Dates on the right
  page.drawText('Date of Verification', {
    x: 350,
    y: sigY - 22,
    size: 9,
    font: helv,
    color: muted,
  })
  page.drawText(formatDate(data.issuedAt), {
    x: 350,
    y: sigY - 36,
    size: 11,
    font: helvBold,
    color: text,
  })
  page.drawText('Valid Through', { x: 350, y: sigY - 58, size: 9, font: helv, color: muted })
  page.drawText(formatDate(data.validThrough), {
    x: 350,
    y: sigY - 72,
    size: 11,
    font: helvBold,
    color: text,
  })

  // ─── QR + footer ───────────────────────────────────────────────────
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/verify-public/${data.certificateNumber}`
  try {
    const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 180, color: { dark: BRAND.primary, light: '#ffffff' } })
    const qrImg = await pdf.embedPng(qrPng)
    const qrDim = 80
    page.drawImage(qrImg, { x: width - 48 - qrDim, y: 72, width: qrDim, height: qrDim })
  } catch {
    // non-fatal
  }

  page.drawText('Verify authenticity at', { x: 48, y: 72, size: 9, font: helv, color: muted })
  page.drawText(verifyUrl, { x: 48, y: 58, size: 9, font: helvBold, color: navy })

  page.drawLine({ start: { x: 48, y: 44 }, end: { x: width - 48, y: 44 }, color: muted, thickness: 0.5 })
  page.drawText(`© ${data.issuedAt.getUTCFullYear()} ${BRAND.legal}`, {
    x: 48,
    y: 28,
    size: 8,
    font: helv,
    color: muted,
  })

  return pdf.save()
}

function isIndividualIncome(d: CertificateData) {
  if (d.path !== 'income') return false
  return d.filingStatus !== 'mfj' && d.filingStatus !== 'spousal_equivalent'
}

function isJointIncome(d: CertificateData) {
  if (d.path !== 'income') return false
  return d.filingStatus === 'mfj' || d.filingStatus === 'spousal_equivalent'
}

function wrap(input: string, cols: number): string[] {
  const words = input.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > cols) {
      lines.push(cur.trim())
      cur = w
    } else {
      cur = (cur + ' ' + w).trim()
    }
  }
  if (cur) lines.push(cur.trim())
  return lines
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const n = parseInt(clean, 16)
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255)
}
