/**
 * Generates three realistic-looking test PDFs for end-to-end verification
 * of the AgFinTax flow:
 *   - Test_1040_2024.pdf  — MFJ · AGI $358,000
 *   - Test_1040_2025.pdf  — MFJ · AGI $372,000
 *   - Test_Paystub_2026_Feb.pdf — YTD $61,000 (annualizes to ≈$366k)
 *
 * The PDFs are NOT official tax forms — they're minimal mocks with the same
 * key labels Azure DI's prebuilt-tax.us.1040 and prebuilt-payStub.us models
 * look for (AdjustedGrossIncome, TaxYear, FilingStatus, CurrentPeriodGrossPay,
 * YearToDateGrossEarnings, etc.). Good enough to prove the pipeline works.
 *
 * Run:  npm run pdfs:test
 */

import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Defaults to `{repo}/docs/test-pdfs`. Override with `TEST_PDF_OUT=/some/path`.
const OUT_DIR =
  process.env.TEST_PDF_OUT ?? path.join(process.cwd(), 'docs', 'test-pdfs')

const INK = rgb(0.04, 0.12, 0.23)
const GOLD = rgb(0.79, 0.64, 0.15)
const TEXT = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.42, 0.44)

type FilingStatus = 'Married filing jointly' | 'Single' | 'Head of household'

type Form1040 = {
  filename: string
  taxYear: number
  filingStatus: FilingStatus
  taxpayerName: string
  taxpayerSsn: string
  spouseName?: string
  spouseSsn?: string
  address1: string
  address2: string
  wagesSalariesTips: number
  interestIncome: number
  dividendIncome: number
  totalIncome: number
  adjustmentsToIncome: number
  adjustedGrossIncome: number
  standardDeduction: number
  taxableIncome: number
  totalTax: number
  federalIncomeTaxWithheld: number
}

type Paystub = {
  filename: string
  employer: string
  employerAddress: string
  employee: string
  employeeAddress: string
  payPeriodStart: string
  payPeriodEnd: string
  payDate: string
  payPeriod: 'Bi-Weekly' | 'Monthly' | 'Weekly' | 'Semi-Monthly'
  currentPeriodGrossPay: number
  yearToDateGrossEarnings: number
  federalTaxWithheld: number
  netPay: number
}

const FORMS_1040: Form1040[] = [
  {
    filename: 'Test_1040_2024.pdf',
    taxYear: 2024,
    filingStatus: 'Married filing jointly',
    taxpayerName: 'LAKSHMAN JAMILI',
    taxpayerSsn: '123-45-6789',
    spouseName: 'PRIYA JAMILI',
    spouseSsn: '987-65-4321',
    address1: '1200 Congress Ave Apt 2410',
    address2: 'Austin, TX 78701',
    wagesSalariesTips: 332_000,
    interestIncome: 4_800,
    dividendIncome: 21_400,
    totalIncome: 358_200,
    adjustmentsToIncome: 200,
    adjustedGrossIncome: 358_000,
    standardDeduction: 29_200,
    taxableIncome: 328_800,
    totalTax: 68_432,
    federalIncomeTaxWithheld: 72_100,
  },
  {
    filename: 'Test_1040_2025.pdf',
    taxYear: 2025,
    filingStatus: 'Married filing jointly',
    taxpayerName: 'LAKSHMAN JAMILI',
    taxpayerSsn: '123-45-6789',
    spouseName: 'PRIYA JAMILI',
    spouseSsn: '987-65-4321',
    address1: '1200 Congress Ave Apt 2410',
    address2: 'Austin, TX 78701',
    wagesSalariesTips: 346_000,
    interestIncome: 5_100,
    dividendIncome: 21_100,
    totalIncome: 372_200,
    adjustmentsToIncome: 200,
    adjustedGrossIncome: 372_000,
    standardDeduction: 30_400,
    taxableIncome: 341_600,
    totalTax: 71_240,
    federalIncomeTaxWithheld: 74_800,
  },
]

const PAYSTUB: Paystub = {
  filename: 'Test_Paystub_2026_Feb.pdf',
  employer: 'Loukri AI, Inc.',
  employerAddress: '500 W 2nd St Ste 1900 · Austin, TX 78701',
  employee: 'LAKSHMAN JAMILI',
  employeeAddress: '1200 Congress Ave Apt 2410 · Austin, TX 78701',
  payPeriodStart: '2026-02-01',
  payPeriodEnd: '2026-02-28',
  payDate: '2026-02-28',
  payPeriod: 'Monthly',
  currentPeriodGrossPay: 30_500,
  yearToDateGrossEarnings: 61_000, // 2 months × 30,500 — annualizes to 366,000
  federalTaxWithheld: 8_140,
  netPay: 21_320,
}

async function build1040(data: Form1040): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header bar
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: INK })
  page.drawText(`Form 1040`, {
    x: 48,
    y: height - 40,
    size: 22,
    font: helvBold,
    color: rgb(1, 1, 1),
  })
  page.drawText(`U.S. Individual Income Tax Return`, {
    x: 48,
    y: height - 60,
    size: 10,
    font: helv,
    color: rgb(1, 1, 1),
  })
  page.drawText(`For the year Jan 1 – Dec 31, ${data.taxYear}`, {
    x: width - 240,
    y: height - 40,
    size: 10,
    font: helv,
    color: rgb(1, 1, 1),
  })
  page.drawText(`OMB No. 1545-0074`, {
    x: width - 240,
    y: height - 60,
    size: 9,
    font: helv,
    color: rgb(0.85, 0.85, 0.85),
  })
  page.drawRectangle({ x: 0, y: height - 76, width, height: 3, color: GOLD })

  let y = height - 110

  // Meta block
  page.drawText(`Tax Year: ${data.taxYear}`, {
    x: 48,
    y,
    size: 11,
    font: helvBold,
    color: TEXT,
  })
  page.drawText(`Filing Status: ${data.filingStatus}`, {
    x: 200,
    y,
    size: 11,
    font: helv,
    color: TEXT,
  })
  y -= 22

  // Taxpayer + Spouse
  drawField(page, helv, helvBold, 'Taxpayer First name & last name', data.taxpayerName, 48, y, 260)
  drawField(page, helv, helvBold, 'Taxpayer SSN', data.taxpayerSsn, 320, y, 200)
  y -= 36

  if (data.spouseName) {
    drawField(
      page,
      helv,
      helvBold,
      'Spouse First name & last name',
      data.spouseName,
      48,
      y,
      260,
    )
    drawField(page, helv, helvBold, 'Spouse SSN', data.spouseSsn ?? '', 320, y, 200)
    y -= 36
  }

  drawField(page, helv, helvBold, 'Home address', data.address1, 48, y, 472)
  y -= 36
  drawField(page, helv, helvBold, 'City, State, ZIP', data.address2, 48, y, 472)
  y -= 50

  // Income section
  page.drawText('Income', { x: 48, y, size: 13, font: helvBold, color: INK })
  y -= 18
  page.drawLine({
    start: { x: 48, y: y + 14 },
    end: { x: width - 48, y: y + 14 },
    color: GOLD,
    thickness: 1,
  })

  const rows: [string, string, number][] = [
    ['1a', 'Wages, salaries, tips', data.wagesSalariesTips],
    ['2b', 'Taxable interest', data.interestIncome],
    ['3b', 'Ordinary dividends', data.dividendIncome],
    ['9', 'Total Income', data.totalIncome],
    ['10', 'Adjustments to Income', data.adjustmentsToIncome],
    ['11', 'Adjusted Gross Income', data.adjustedGrossIncome],
    ['12', 'Standard Deduction', data.standardDeduction],
    ['15', 'Taxable Income', data.taxableIncome],
    ['24', 'Total Tax', data.totalTax],
    ['25a', 'Federal Income Tax Withheld', data.federalIncomeTaxWithheld],
  ]

  for (const [line, label, amount] of rows) {
    drawLineItem(page, helv, helvBold, line, label, amount, 48, y)
    y -= 20
  }

  // Key fields box (clearly labeled for Azure DI)
  y -= 10
  const boxY = y
  page.drawRectangle({
    x: 48,
    y: boxY - 96,
    width: width - 96,
    height: 96,
    color: rgb(0.98, 0.96, 0.9),
    borderColor: GOLD,
    borderWidth: 1,
  })
  page.drawText('Key values (AgFinTax test extraction)', {
    x: 60,
    y: boxY - 16,
    size: 9,
    font: helvBold,
    color: rgb(0.56, 0.45, 0.1),
  })

  const key: [string, string][] = [
    ['AdjustedGrossIncome', formatUsd(data.adjustedGrossIncome)],
    ['TaxYear', String(data.taxYear)],
    ['FilingStatus', data.filingStatus],
    ['Taxpayer', data.taxpayerName],
    ['TotalIncome', formatUsd(data.totalIncome)],
    ['TaxableIncome', formatUsd(data.taxableIncome)],
  ]
  let ky = boxY - 32
  for (const [k, v] of key) {
    page.drawText(`${k}:`, { x: 60, y: ky, size: 9, font: helvBold, color: TEXT })
    page.drawText(v, { x: 190, y: ky, size: 9, font: helv, color: TEXT })
    ky -= 11
  }

  // Signature & footer
  page.drawLine({
    start: { x: 48, y: 80 },
    end: { x: 260, y: 80 },
    color: TEXT,
    thickness: 0.5,
  })
  page.drawText('Taxpayer signature · date', {
    x: 48,
    y: 66,
    size: 8,
    font: helv,
    color: MUTED,
  })
  page.drawLine({
    start: { x: 320, y: 80 },
    end: { x: 530, y: 80 },
    color: TEXT,
    thickness: 0.5,
  })
  page.drawText('Spouse signature · date', {
    x: 320,
    y: 66,
    size: 8,
    font: helv,
    color: MUTED,
  })

  page.drawLine({
    start: { x: 48, y: 44 },
    end: { x: width - 48, y: 44 },
    color: MUTED,
    thickness: 0.3,
  })
  page.drawText(
    `AgFinTax Test Form — not an official IRS submission. Generated ${new Date().toISOString().split('T')[0]}.`,
    { x: 48, y: 28, size: 7, font: helv, color: MUTED },
  )

  return pdf.save()
}

async function buildPaystub(data: Paystub): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: INK })
  page.drawText(data.employer, {
    x: 48,
    y: height - 40,
    size: 18,
    font: helvBold,
    color: rgb(1, 1, 1),
  })
  page.drawText('Earnings Statement', {
    x: 48,
    y: height - 60,
    size: 10,
    font: helv,
    color: rgb(0.85, 0.85, 0.85),
  })
  page.drawText(`Pay Date: ${data.payDate}`, {
    x: width - 220,
    y: height - 40,
    size: 10,
    font: helvBold,
    color: rgb(1, 1, 1),
  })
  page.drawText(data.payPeriod, {
    x: width - 220,
    y: height - 58,
    size: 9,
    font: helv,
    color: rgb(0.85, 0.85, 0.85),
  })
  page.drawRectangle({ x: 0, y: height - 76, width, height: 3, color: GOLD })

  let y = height - 110

  // Employer + employee blocks
  page.drawText('Employer', {
    x: 48,
    y,
    size: 9,
    font: helvBold,
    color: MUTED,
  })
  page.drawText('Employee', {
    x: 320,
    y,
    size: 9,
    font: helvBold,
    color: MUTED,
  })
  y -= 14
  page.drawText(data.employer, { x: 48, y, size: 11, font: helvBold, color: TEXT })
  page.drawText(data.employee, { x: 320, y, size: 11, font: helvBold, color: TEXT })
  y -= 14
  page.drawText(data.employerAddress, {
    x: 48,
    y,
    size: 9,
    font: helv,
    color: MUTED,
  })
  page.drawText(data.employeeAddress, {
    x: 320,
    y,
    size: 9,
    font: helv,
    color: MUTED,
  })
  y -= 30

  // Pay period meta
  drawField(
    page,
    helv,
    helvBold,
    'Pay Period Start',
    data.payPeriodStart,
    48,
    y,
    130,
  )
  drawField(page, helv, helvBold, 'Pay Period End', data.payPeriodEnd, 190, y, 130)
  drawField(page, helv, helvBold, 'Pay Period', data.payPeriod, 332, y, 130)
  y -= 48

  // Earnings table
  page.drawText('Earnings', { x: 48, y, size: 13, font: helvBold, color: INK })
  y -= 16
  page.drawLine({
    start: { x: 48, y: y + 12 },
    end: { x: width - 48, y: y + 12 },
    color: GOLD,
    thickness: 1,
  })

  const cols = ['Description', 'Rate', 'Hours', 'Current', 'Year-to-Date']
  const colX = [60, 220, 280, 360, 470]
  y -= 4
  cols.forEach((c, i) => {
    page.drawText(c, { x: colX[i], y, size: 9, font: helvBold, color: MUTED })
  })
  y -= 16

  const rows = [
    [
      'Regular Pay',
      '$30,500.00 /mo',
      '1.00',
      formatUsd(data.currentPeriodGrossPay),
      formatUsd(data.yearToDateGrossEarnings),
    ],
  ]
  for (const r of rows) {
    r.forEach((cell, i) => {
      page.drawText(cell, {
        x: colX[i],
        y,
        size: 10,
        font: i === 0 ? helvBold : helv,
        color: TEXT,
      })
    })
    y -= 18
  }

  y -= 10
  // Totals row (highlighted)
  page.drawRectangle({
    x: 48,
    y: y - 22,
    width: width - 96,
    height: 26,
    color: rgb(0.98, 0.96, 0.9),
  })
  page.drawText('TOTAL GROSS', { x: 60, y: y - 14, size: 11, font: helvBold, color: INK })
  page.drawText(`Current: ${formatUsd(data.currentPeriodGrossPay)}`, {
    x: 260,
    y: y - 14,
    size: 10,
    font: helv,
    color: TEXT,
  })
  page.drawText(`YTD: ${formatUsd(data.yearToDateGrossEarnings)}`, {
    x: 440,
    y: y - 14,
    size: 10,
    font: helvBold,
    color: TEXT,
  })
  y -= 48

  // Deductions
  drawLineItem(page, helv, helvBold, '', 'Federal Income Tax Withheld', data.federalTaxWithheld, 48, y)
  y -= 20
  drawLineItem(page, helv, helvBold, '', 'Net Pay', data.netPay, 48, y)

  // Key values box (clearly labeled for Azure DI)
  y -= 40
  page.drawRectangle({
    x: 48,
    y: y - 72,
    width: width - 96,
    height: 72,
    color: rgb(0.98, 0.96, 0.9),
    borderColor: GOLD,
    borderWidth: 1,
  })
  page.drawText('Key values (AgFinTax test extraction)', {
    x: 60,
    y: y - 14,
    size: 9,
    font: helvBold,
    color: rgb(0.56, 0.45, 0.1),
  })
  const key: [string, string][] = [
    ['CurrentPeriodGrossPay', formatUsd(data.currentPeriodGrossPay)],
    ['YearToDateGrossEarnings', formatUsd(data.yearToDateGrossEarnings)],
    ['PayPeriod', data.payPeriod],
    ['EmployerName', data.employer],
  ]
  let ky = y - 30
  for (const [k, v] of key) {
    page.drawText(`${k}:`, { x: 60, y: ky, size: 9, font: helvBold, color: TEXT })
    page.drawText(v, { x: 210, y: ky, size: 9, font: helv, color: TEXT })
    ky -= 11
  }

  // Footer
  page.drawLine({
    start: { x: 48, y: 44 },
    end: { x: width - 48, y: 44 },
    color: MUTED,
    thickness: 0.3,
  })
  page.drawText(
    `AgFinTax Test Pay Stub — not an official payroll document. Generated ${new Date().toISOString().split('T')[0]}.`,
    { x: 48, y: 28, size: 7, font: helv, color: MUTED },
  )

  return pdf.save()
}

function drawField(
  page: ReturnType<PDFDocument['addPage']>,
  helv: Awaited<ReturnType<PDFDocument['embedFont']>>,
  helvBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
) {
  page.drawText(label, { x, y: y + 14, size: 8, font: helv, color: MUTED })
  page.drawRectangle({
    x,
    y: y - 4,
    width: w,
    height: 20,
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 0.5,
    color: rgb(0.99, 0.99, 0.99),
  })
  page.drawText(value, {
    x: x + 6,
    y: y + 2,
    size: 10,
    font: helvBold,
    color: TEXT,
    maxWidth: w - 12,
  })
}

function drawLineItem(
  page: ReturnType<PDFDocument['addPage']>,
  helv: Awaited<ReturnType<PDFDocument['embedFont']>>,
  helvBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
  line: string,
  label: string,
  amount: number,
  x: number,
  y: number,
) {
  if (line) {
    page.drawText(line, { x, y, size: 10, font: helvBold, color: INK })
  }
  page.drawText(label, { x: x + 30, y, size: 10, font: helv, color: TEXT })
  const text = formatUsd(amount)
  const textWidth = helvBold.widthOfTextAtSize(text, 10)
  page.drawText(text, {
    x: 612 - 48 - textWidth,
    y,
    size: 10,
    font: helvBold,
    color: TEXT,
  })
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  console.info(`Writing test PDFs to ${OUT_DIR}\n`)

  for (const form of FORMS_1040) {
    const bytes = await build1040(form)
    const outPath = path.join(OUT_DIR, form.filename)
    fs.writeFileSync(outPath, bytes)
    console.info(
      `✅ ${form.filename}  (${(bytes.length / 1024).toFixed(1)} KB)  AGI ${formatUsd(form.adjustedGrossIncome)}`,
    )
  }

  const stubBytes = await buildPaystub(PAYSTUB)
  const stubPath = path.join(OUT_DIR, PAYSTUB.filename)
  fs.writeFileSync(stubPath, stubBytes)
  console.info(
    `✅ ${PAYSTUB.filename}  (${(stubBytes.length / 1024).toFixed(1)} KB)  YTD ${formatUsd(PAYSTUB.yearToDateGrossEarnings)}`,
  )

  console.info(`\nAll three saved in ${OUT_DIR}. Upload them via /verify/[id].`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
