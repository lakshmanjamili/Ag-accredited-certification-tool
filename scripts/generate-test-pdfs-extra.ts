/**
 * Companion to generate-test-pdfs.ts.
 *
 * Produces the additional test fixtures Krishna asked for so we can run
 * EVERY accreditation path end-to-end on the current 2026 cycle:
 *
 *   Income path
 *   ───────────
 *     Test_W2_2025.pdf            — year-end W-2 for tax year 2025
 *     Test_Paystub_2026_Apr.pdf   — April 2026 YTD (4 months × $30,500 = $122,000)
 *
 *   Net-worth path (>$1M excluding primary residence)
 *   ─────────────────────────────────────────────────
 *     Test_BankStatement_2026_Mar.pdf   — Chase · ending balance $850,000
 *     Test_Brokerage_2026_Q1.pdf        — Fidelity · ending balance $620,000
 *     Test_Retirement_2026_Q1.pdf       — Vanguard 401(k) · ending balance $480,000
 *     Test_Mortgage_2026_Mar.pdf        — primary residence · principal $420,000
 *     Test_AutoLoan_2026_Mar.pdf        — auto loan · principal $35,000
 *
 * Every document includes a "Key values (AgFinTax test extraction)" box with
 * the exact field names src/lib/extraction.ts looks for, so Azure DI's
 * prebuilt-tax.us.w2, prebuilt-payStub.us, prebuilt-bankStatement, and
 * prebuilt-layout models all return useful fields.
 *
 * Run:  npm run pdfs:test:extra
 */

import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'

const OUT_DIR =
  process.env.TEST_PDF_OUT ?? path.join(process.cwd(), 'docs', 'test-pdfs')

const INK = rgb(0.04, 0.12, 0.23)
const GOLD = rgb(0.79, 0.64, 0.15)
const TEXT = rgb(0.1, 0.1, 0.1)
const MUTED = rgb(0.4, 0.42, 0.44)
const KEYBOX = rgb(0.98, 0.96, 0.9)

// ────────────────────────────────────────────────────────────────────────
//  W-2  ·  prebuilt-tax.us.w2
// ────────────────────────────────────────────────────────────────────────

type W2 = {
  filename: string
  taxYear: number
  employer: string
  employerEin: string
  employerAddress: string
  employee: string
  employeeSsn: string
  employeeAddress: string
  wagesBox1: number
  fedTaxWithheldBox2: number
  ssWagesBox3: number
  ssTaxBox4: number
  medicareWagesBox5: number
  medicareTaxBox6: number
}

const W2_2025: W2 = {
  filename: 'Test_W2_2025.pdf',
  taxYear: 2025,
  employer: 'LOUKRI AI, INC.',
  employerEin: '88-1234567',
  employerAddress: '500 W 2nd St Ste 1900, Austin, TX 78701',
  employee: 'LAKSHMAN JAMILI',
  employeeSsn: '123-45-6789',
  employeeAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  wagesBox1: 346_000,
  fedTaxWithheldBox2: 74_800,
  ssWagesBox3: 168_600, // 2025 SS wage base
  ssTaxBox4: 10_453.20,
  medicareWagesBox5: 346_000,
  medicareTaxBox6: 5_017,
}

async function buildW2(data: W2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // Header
  drawHeaderBar(page, width, height, helv, helvBold, 'Form W-2', 'Wage and Tax Statement', `${data.taxYear}  ·  Copy B  ·  OMB No. 1545-0008`)

  let y = height - 110

  // Block: employer + employee meta
  drawBoxLabel(page, helv, helvBold, 'a  Employee SSN', data.employeeSsn, 48, y, 220)
  drawBoxLabel(page, helv, helvBold, 'b  Employer EIN', data.employerEin, 280, y, 240)
  y -= 50

  drawBoxLabel(page, helv, helvBold, "c  Employer's name, address, ZIP", `${data.employer}\n${data.employerAddress}`, 48, y, 472, 36)
  y -= 70

  drawBoxLabel(page, helv, helvBold, "e  Employee's name", data.employee, 48, y, 280)
  drawBoxLabel(page, helv, helvBold, 'Tax Year', String(data.taxYear), 340, y, 180)
  y -= 50

  drawBoxLabel(page, helv, helvBold, "f  Employee's address, ZIP", data.employeeAddress, 48, y, 472)
  y -= 60

  // Numbered boxes grid (1-6)
  const boxes: [string, string, string][] = [
    ['1', 'Wages, tips, other compensation', formatUsd(data.wagesBox1)],
    ['2', 'Federal income tax withheld', formatUsd(data.fedTaxWithheldBox2)],
    ['3', 'Social security wages', formatUsd(data.ssWagesBox3)],
    ['4', 'Social security tax withheld', formatUsd(data.ssTaxBox4)],
    ['5', 'Medicare wages and tips', formatUsd(data.medicareWagesBox5)],
    ['6', 'Medicare tax withheld', formatUsd(data.medicareTaxBox6)],
  ]
  const cellW = 236
  const cellH = 50
  for (let i = 0; i < boxes.length; i++) {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 48 + col * cellW
    const yy = y - row * cellH
    drawBoxLabel(page, helv, helvBold, `${boxes[i][0]}  ${boxes[i][1]}`, boxes[i][2], x, yy, cellW - 12, 18)
  }

  // Key-values box (Azure DI hint)
  const kvY = y - 3 * cellH - 24
  drawKeyValuesBox(page, helv, helvBold, width, kvY, [
    ['WagesTipsAndOtherCompensation', formatUsd(data.wagesBox1)],
    ['FederalIncomeTaxWithheld', formatUsd(data.fedTaxWithheldBox2)],
    ['SocialSecurityWages', formatUsd(data.ssWagesBox3)],
    ['MedicareWagesAndTips', formatUsd(data.medicareWagesBox5)],
    ['TaxYear', String(data.taxYear)],
    ['Employer', data.employer],
    ['Employee', data.employee],
  ])

  drawFooter(page, helv, width, 'AgFinTax Test W-2 — not an official IRS form.')
  return pdf.save()
}

// ────────────────────────────────────────────────────────────────────────
//  Paystub  ·  April 2026 YTD
// ────────────────────────────────────────────────────────────────────────

type Paystub = {
  filename: string
  employer: string
  employerAddress: string
  employee: string
  employeeAddress: string
  payPeriodStart: string
  payPeriodEnd: string
  payDate: string
  payPeriod: string
  currentPeriodGrossPay: number
  yearToDateGrossEarnings: number
  federalTaxWithheld: number
  netPay: number
}

const PAYSTUB_APR_2026: Paystub = {
  filename: 'Test_Paystub_2026_Apr.pdf',
  employer: 'Loukri AI, Inc.',
  employerAddress: '500 W 2nd St Ste 1900 · Austin, TX 78701',
  employee: 'LAKSHMAN JAMILI',
  employeeAddress: '1200 Congress Ave Apt 2410 · Austin, TX 78701',
  payPeriodStart: '2026-04-01',
  payPeriodEnd: '2026-04-30',
  payDate: '2026-04-30',
  payPeriod: 'Monthly',
  currentPeriodGrossPay: 30_500,
  yearToDateGrossEarnings: 122_000, // 4 × 30,500 — annualizes to $366k
  federalTaxWithheld: 8_140,
  netPay: 21_320,
}

async function buildPaystub(data: Paystub): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  drawHeaderBar(page, width, height, helv, helvBold, data.employer, 'Earnings Statement', `Pay Date ${data.payDate}  ·  ${data.payPeriod}`)

  let y = height - 110

  page.drawText('Employer', { x: 48, y, size: 9, font: helvBold, color: MUTED })
  page.drawText('Employee', { x: 320, y, size: 9, font: helvBold, color: MUTED })
  y -= 14
  page.drawText(data.employer, { x: 48, y, size: 11, font: helvBold, color: TEXT })
  page.drawText(data.employee, { x: 320, y, size: 11, font: helvBold, color: TEXT })
  y -= 14
  page.drawText(data.employerAddress, { x: 48, y, size: 9, font: helv, color: MUTED })
  page.drawText(data.employeeAddress, { x: 320, y, size: 9, font: helv, color: MUTED })
  y -= 30

  drawBoxLabel(page, helv, helvBold, 'Pay Period Start', data.payPeriodStart, 48, y, 130)
  drawBoxLabel(page, helv, helvBold, 'Pay Period End', data.payPeriodEnd, 190, y, 130)
  drawBoxLabel(page, helv, helvBold, 'Pay Period', data.payPeriod, 332, y, 130)
  y -= 56

  page.drawText('Earnings', { x: 48, y, size: 13, font: helvBold, color: INK })
  y -= 16
  page.drawLine({ start: { x: 48, y: y + 12 }, end: { x: width - 48, y: y + 12 }, color: GOLD, thickness: 1 })

  const cols = ['Description', 'Rate', 'Hours', 'Current', 'Year-to-Date']
  const colX = [60, 220, 280, 360, 470]
  y -= 4
  cols.forEach((c, i) => page.drawText(c, { x: colX[i], y, size: 9, font: helvBold, color: MUTED }))
  y -= 16

  const row = ['Regular Pay', '$30,500.00 /mo', '1.00', formatUsd(data.currentPeriodGrossPay), formatUsd(data.yearToDateGrossEarnings)]
  row.forEach((cell, i) =>
    page.drawText(cell, { x: colX[i], y, size: 10, font: i === 0 ? helvBold : helv, color: TEXT }),
  )
  y -= 28

  page.drawRectangle({ x: 48, y: y - 22, width: width - 96, height: 26, color: KEYBOX })
  page.drawText('TOTAL GROSS', { x: 60, y: y - 14, size: 11, font: helvBold, color: INK })
  page.drawText(`Current: ${formatUsd(data.currentPeriodGrossPay)}`, { x: 260, y: y - 14, size: 10, font: helv, color: TEXT })
  page.drawText(`YTD: ${formatUsd(data.yearToDateGrossEarnings)}`, { x: 440, y: y - 14, size: 10, font: helvBold, color: TEXT })
  y -= 50

  drawLineItem(page, helv, helvBold, '', 'Federal Income Tax Withheld', data.federalTaxWithheld, 48, y)
  y -= 20
  drawLineItem(page, helv, helvBold, '', 'Net Pay', data.netPay, 48, y)

  drawKeyValuesBox(page, helv, helvBold, width, y - 36, [
    ['CurrentPeriodGrossPay', formatUsd(data.currentPeriodGrossPay)],
    ['YearToDateGrossEarnings', formatUsd(data.yearToDateGrossEarnings)],
    ['PayPeriod', data.payPeriod],
    ['EmployerName', data.employer],
    ['PayDate', data.payDate],
  ])

  drawFooter(page, helv, width, 'AgFinTax Test Pay Stub — not an official payroll document.')
  return pdf.save()
}

// ────────────────────────────────────────────────────────────────────────
//  Bank / Brokerage / Retirement  ·  prebuilt-bankStatement
// ────────────────────────────────────────────────────────────────────────

type BalanceStatement = {
  filename: string
  bankName: string
  bankAddress: string
  accountHolderName: string
  accountHolderAddress: string
  accountNumber: string
  accountType: string
  statementStartDate: string
  statementEndDate: string
  beginningBalance: number
  endingBalance: number
  transactions: Array<{ date: string; description: string; amount: number; type: 'credit' | 'debit' }>
  flavor: 'bank' | 'brokerage' | 'retirement'
}

const BANK_STATEMENT: BalanceStatement = {
  filename: 'Test_BankStatement_2026_Mar.pdf',
  bankName: 'JPMORGAN CHASE BANK, N.A.',
  bankAddress: '270 Park Ave, New York, NY 10017',
  accountHolderName: 'LAKSHMAN JAMILI',
  accountHolderAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  accountNumber: '****-****-1029',
  accountType: 'Premier Plus Checking',
  statementStartDate: '2026-03-01',
  statementEndDate: '2026-03-31',
  beginningBalance: 812_400,
  endingBalance: 850_120,
  flavor: 'bank',
  transactions: [
    { date: '2026-03-02', description: 'Direct Deposit · Loukri AI Payroll', amount: 21_320, type: 'credit' },
    { date: '2026-03-05', description: 'Wire Transfer In · Schwab brokerage', amount: 50_000, type: 'credit' },
    { date: '2026-03-10', description: 'ACH Out · Vanguard 401(k) contribution', amount: 12_000, type: 'debit' },
    { date: '2026-03-15', description: 'Mortgage Payment · Wells Fargo', amount: 4_200, type: 'debit' },
    { date: '2026-03-22', description: 'Card Purchase · Whole Foods', amount: 480, type: 'debit' },
    { date: '2026-03-28', description: 'Interest Earned', amount: 1_080, type: 'credit' },
  ],
}

const BROKERAGE_STATEMENT: BalanceStatement = {
  filename: 'Test_Brokerage_2026_Q1.pdf',
  bankName: 'FIDELITY BROKERAGE SERVICES LLC',
  bankAddress: '900 Salem St, Smithfield, RI 02917',
  accountHolderName: 'LAKSHMAN JAMILI',
  accountHolderAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  accountNumber: 'Z08-374921',
  accountType: 'Individual Brokerage · Margin',
  statementStartDate: '2026-01-01',
  statementEndDate: '2026-03-31',
  beginningBalance: 562_300,
  endingBalance: 620_480,
  flavor: 'brokerage',
  transactions: [
    { date: '2026-01-12', description: 'Buy 50 sh AAPL @ $214.10', amount: 10_705, type: 'debit' },
    { date: '2026-02-04', description: 'Dividend · VTI', amount: 1_240, type: 'credit' },
    { date: '2026-02-19', description: 'Sell 20 sh NVDA @ $812.40', amount: 16_248, type: 'credit' },
    { date: '2026-03-08', description: 'Cash Transfer In · Chase Premier', amount: 50_000, type: 'credit' },
    { date: '2026-03-31', description: 'Net unrealized gain · long positions', amount: 14_500, type: 'credit' },
  ],
}

const RETIREMENT_STATEMENT: BalanceStatement = {
  filename: 'Test_Retirement_2026_Q1.pdf',
  bankName: 'VANGUARD FIDUCIARY TRUST COMPANY',
  bankAddress: '100 Vanguard Blvd, Malvern, PA 19355',
  accountHolderName: 'LAKSHMAN JAMILI',
  accountHolderAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  accountNumber: 'V-401K-558712',
  accountType: '401(k) · Loukri AI, Inc. Plan',
  statementStartDate: '2026-01-01',
  statementEndDate: '2026-03-31',
  beginningBalance: 441_900,
  endingBalance: 480_215,
  flavor: 'retirement',
  transactions: [
    { date: '2026-01-15', description: 'Employee Contribution · Pre-tax', amount: 5_750, type: 'credit' },
    { date: '2026-01-15', description: 'Employer Match · 6%', amount: 1_830, type: 'credit' },
    { date: '2026-02-15', description: 'Employee Contribution · Pre-tax', amount: 5_750, type: 'credit' },
    { date: '2026-02-15', description: 'Employer Match · 6%', amount: 1_830, type: 'credit' },
    { date: '2026-03-15', description: 'Employee Contribution · Pre-tax', amount: 5_750, type: 'credit' },
    { date: '2026-03-31', description: 'Net market gain', amount: 17_405, type: 'credit' },
  ],
}

async function buildBalanceStatement(data: BalanceStatement): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const title =
    data.flavor === 'bank' ? 'Account Statement' :
    data.flavor === 'brokerage' ? 'Brokerage Account Statement' :
    'Retirement Account Statement'

  drawHeaderBar(
    page, width, height, helv, helvBold,
    data.bankName,
    title,
    `${data.statementStartDate}  to  ${data.statementEndDate}`,
  )

  let y = height - 112

  // Bank + holder block
  page.drawText('Institution', { x: 48, y, size: 9, font: helvBold, color: MUTED })
  page.drawText('Account Holder', { x: 320, y, size: 9, font: helvBold, color: MUTED })
  y -= 14
  page.drawText(data.bankName, { x: 48, y, size: 11, font: helvBold, color: TEXT })
  page.drawText(data.accountHolderName, { x: 320, y, size: 11, font: helvBold, color: TEXT })
  y -= 14
  page.drawText(data.bankAddress, { x: 48, y, size: 9, font: helv, color: MUTED })
  page.drawText(data.accountHolderAddress, { x: 320, y, size: 9, font: helv, color: MUTED })
  y -= 28

  drawBoxLabel(page, helv, helvBold, 'Account Number', data.accountNumber, 48, y, 220)
  drawBoxLabel(page, helv, helvBold, 'Account Type', data.accountType, 280, y, 240)
  y -= 50

  // Balance summary band
  page.drawRectangle({ x: 48, y: y - 56, width: width - 96, height: 60, color: KEYBOX, borderColor: GOLD, borderWidth: 1 })
  page.drawText('Statement Summary', { x: 60, y: y - 14, size: 9, font: helvBold, color: rgb(0.56, 0.45, 0.1) })
  page.drawText('Beginning Balance', { x: 60, y: y - 36, size: 10, font: helv, color: TEXT })
  page.drawText(formatUsd(data.beginningBalance), { x: 200, y: y - 36, size: 11, font: helvBold, color: TEXT })
  page.drawText('Ending Balance', { x: 320, y: y - 36, size: 10, font: helv, color: TEXT })
  page.drawText(formatUsd(data.endingBalance), { x: 440, y: y - 36, size: 12, font: helvBold, color: INK })
  y -= 80

  // Transactions
  page.drawText('Transactions', { x: 48, y, size: 12, font: helvBold, color: INK })
  y -= 14
  page.drawLine({ start: { x: 48, y: y + 10 }, end: { x: width - 48, y: y + 10 }, color: GOLD, thickness: 1 })
  const tCols = ['Date', 'Description', 'Debit', 'Credit', 'Amount']
  const tX = [60, 130, 360, 420, 500]
  tCols.forEach((c, i) => page.drawText(c, { x: tX[i], y, size: 9, font: helvBold, color: MUTED }))
  y -= 14

  for (const t of data.transactions) {
    page.drawText(t.date, { x: tX[0], y, size: 9, font: helv, color: TEXT })
    page.drawText(truncate(t.description, 40), { x: tX[1], y, size: 9, font: helv, color: TEXT })
    if (t.type === 'debit') page.drawText(formatUsd(t.amount), { x: tX[2], y, size: 9, font: helv, color: TEXT })
    if (t.type === 'credit') page.drawText(formatUsd(t.amount), { x: tX[3], y, size: 9, font: helv, color: TEXT })
    page.drawText(`${t.type === 'debit' ? '-' : '+'}${formatUsd(t.amount)}`, { x: tX[4], y, size: 9, font: helvBold, color: t.type === 'debit' ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.45, 0.2) })
    y -= 14
  }

  // Key-values box (Azure DI hint)
  drawKeyValuesBox(page, helv, helvBold, width, y - 16, [
    ['BankName', data.bankName],
    ['AccountHolderName', data.accountHolderName],
    ['AccountNumber', data.accountNumber],
    ['BeginningBalance', formatUsd(data.beginningBalance)],
    ['EndingBalance', formatUsd(data.endingBalance)],
    ['StatementStartDate', data.statementStartDate],
    ['StatementEndDate', data.statementEndDate],
  ])

  drawFooter(page, helv, width, `AgFinTax Test ${title} — synthetic data, not a real institution document.`)
  return pdf.save()
}

// ────────────────────────────────────────────────────────────────────────
//  Mortgage + auto-loan statements  ·  prebuilt-layout (raw OCR)
// ────────────────────────────────────────────────────────────────────────

type LoanStatement = {
  filename: string
  lender: string
  lenderAddress: string
  borrowerName: string
  borrowerAddress: string
  loanType: 'Mortgage' | 'Auto Loan'
  loanNumber: string
  collateralDescription: string
  statementDate: string
  principalBalance: number
  escrowBalance: number
  monthlyPayment: number
  interestRate: number // %
  originalPrincipal: number
  payoffEstimateGoodThrough: string
  nextPaymentDue: string
}

const MORTGAGE_STATEMENT: LoanStatement = {
  filename: 'Test_Mortgage_2026_Mar.pdf',
  lender: 'WELLS FARGO HOME MORTGAGE',
  lenderAddress: 'PO Box 14411, Des Moines, IA 50306',
  borrowerName: 'LAKSHMAN JAMILI',
  borrowerAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  loanType: 'Mortgage',
  loanNumber: '0421-0987345',
  collateralDescription: 'Primary residence — 1200 Congress Ave Apt 2410, Austin, TX 78701',
  statementDate: '2026-03-31',
  principalBalance: 420_180,
  escrowBalance: 8_400,
  monthlyPayment: 4_200,
  interestRate: 6.25,
  originalPrincipal: 535_000,
  payoffEstimateGoodThrough: '2026-04-15',
  nextPaymentDue: '2026-04-01',
}

const AUTO_LOAN_STATEMENT: LoanStatement = {
  filename: 'Test_AutoLoan_2026_Mar.pdf',
  lender: 'CHASE AUTO FINANCE',
  lenderAddress: 'PO Box 901076, Fort Worth, TX 76101',
  borrowerName: 'LAKSHMAN JAMILI',
  borrowerAddress: '1200 Congress Ave Apt 2410, Austin, TX 78701',
  loanType: 'Auto Loan',
  loanNumber: 'AUT-558391-22',
  collateralDescription: '2024 Tesla Model Y · VIN 5YJYGDEE0PF***123',
  statementDate: '2026-03-31',
  principalBalance: 35_240,
  escrowBalance: 0,
  monthlyPayment: 740,
  interestRate: 7.49,
  originalPrincipal: 58_900,
  payoffEstimateGoodThrough: '2026-04-15',
  nextPaymentDue: '2026-04-12',
}

async function buildLoanStatement(data: LoanStatement): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const { width, height } = page.getSize()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)

  drawHeaderBar(
    page, width, height, helv, helvBold,
    data.lender,
    `${data.loanType} · Periodic Statement`,
    `Statement Date ${data.statementDate}`,
  )

  let y = height - 112

  page.drawText('Lender', { x: 48, y, size: 9, font: helvBold, color: MUTED })
  page.drawText('Borrower', { x: 320, y, size: 9, font: helvBold, color: MUTED })
  y -= 14
  page.drawText(data.lender, { x: 48, y, size: 11, font: helvBold, color: TEXT })
  page.drawText(data.borrowerName, { x: 320, y, size: 11, font: helvBold, color: TEXT })
  y -= 14
  page.drawText(data.lenderAddress, { x: 48, y, size: 9, font: helv, color: MUTED })
  page.drawText(data.borrowerAddress, { x: 320, y, size: 9, font: helv, color: MUTED })
  y -= 30

  drawBoxLabel(page, helv, helvBold, 'Loan Number', data.loanNumber, 48, y, 220)
  drawBoxLabel(page, helv, helvBold, 'Loan Type', data.loanType, 280, y, 240)
  y -= 50

  drawBoxLabel(page, helv, helvBold, 'Collateral', data.collateralDescription, 48, y, 472, 18)
  y -= 50

  // Balance band
  page.drawRectangle({ x: 48, y: y - 86, width: width - 96, height: 90, color: KEYBOX, borderColor: GOLD, borderWidth: 1 })
  page.drawText('Loan Summary', { x: 60, y: y - 14, size: 9, font: helvBold, color: rgb(0.56, 0.45, 0.1) })

  const lines: [string, string][] = [
    ['Principal Balance Outstanding', formatUsd(data.principalBalance)],
    ['Original Principal', formatUsd(data.originalPrincipal)],
    ['Escrow Balance', formatUsd(data.escrowBalance)],
    ['Monthly Payment', formatUsd(data.monthlyPayment)],
    ['Interest Rate', `${data.interestRate.toFixed(2)}%`],
    ['Next Payment Due', data.nextPaymentDue],
    ['Payoff Estimate Good Through', data.payoffEstimateGoodThrough],
  ]
  let ly = y - 30
  for (const [k, v] of lines) {
    page.drawText(k, { x: 60, y: ly, size: 9, font: helv, color: TEXT })
    page.drawText(v, { x: 320, y: ly, size: 10, font: helvBold, color: TEXT })
    ly -= 10
  }
  y -= 110

  // Note: layout OCR doesn't recognize specific fields, but we still print
  // a labeled key-values block so a CPA reviewing this manually can verify.
  drawKeyValuesBox(page, helv, helvBold, width, y, [
    ['LoanType', data.loanType],
    ['LoanNumber', data.loanNumber],
    ['BorrowerName', data.borrowerName],
    ['PrincipalBalance', formatUsd(data.principalBalance)],
    ['OriginalPrincipal', formatUsd(data.originalPrincipal)],
    ['StatementDate', data.statementDate],
    ['CollateralDescription', data.collateralDescription],
  ])

  drawFooter(page, helv, width, `AgFinTax Test ${data.loanType} Statement — synthetic data.`)
  return pdf.save()
}

// ────────────────────────────────────────────────────────────────────────
//  Shared drawing helpers
// ────────────────────────────────────────────────────────────────────────

function drawHeaderBar(
  page: PDFPage,
  width: number,
  height: number,
  helv: PDFFont,
  helvBold: PDFFont,
  title: string,
  subtitle: string,
  rightTopLabel: string,
) {
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: INK })
  page.drawText(title, { x: 48, y: height - 40, size: 18, font: helvBold, color: rgb(1, 1, 1) })
  page.drawText(subtitle, { x: 48, y: height - 60, size: 10, font: helv, color: rgb(0.85, 0.85, 0.85) })
  const w = helv.widthOfTextAtSize(rightTopLabel, 9)
  page.drawText(rightTopLabel, { x: width - 48 - w, y: height - 40, size: 9, font: helv, color: rgb(0.92, 0.92, 0.92) })
  page.drawRectangle({ x: 0, y: height - 76, width, height: 3, color: GOLD })
}

function drawBoxLabel(
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  h = 20,
) {
  page.drawText(label, { x, y: y + 14, size: 8, font: helv, color: MUTED })
  page.drawRectangle({
    x,
    y: y - 4,
    width: w,
    height: h,
    borderColor: rgb(0.82, 0.85, 0.88),
    borderWidth: 0.5,
    color: rgb(0.99, 0.99, 0.99),
  })
  // Multi-line value support — split by \n
  const lines = value.split('\n')
  let ly = y + 2 + (lines.length - 1) * 11
  for (const line of lines) {
    page.drawText(line, { x: x + 6, y: ly, size: 10, font: helvBold, color: TEXT, maxWidth: w - 12 })
    ly -= 11
  }
}

function drawLineItem(
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  line: string,
  label: string,
  amount: number,
  x: number,
  y: number,
) {
  if (line) page.drawText(line, { x, y, size: 10, font: helvBold, color: INK })
  page.drawText(label, { x: x + 30, y, size: 10, font: helv, color: TEXT })
  const text = formatUsd(amount)
  const tw = helvBold.widthOfTextAtSize(text, 10)
  page.drawText(text, { x: 612 - 48 - tw, y, size: 10, font: helvBold, color: TEXT })
}

function drawKeyValuesBox(
  page: PDFPage,
  helv: PDFFont,
  helvBold: PDFFont,
  width: number,
  topY: number,
  pairs: Array<[string, string]>,
) {
  const padTop = 16
  const lineH = 11
  const h = padTop + pairs.length * lineH + 8
  page.drawRectangle({
    x: 48,
    y: topY - h,
    width: width - 96,
    height: h,
    color: KEYBOX,
    borderColor: GOLD,
    borderWidth: 1,
  })
  page.drawText('Key values (AgFinTax test extraction)', {
    x: 60,
    y: topY - 14,
    size: 9,
    font: helvBold,
    color: rgb(0.56, 0.45, 0.1),
  })
  let ky = topY - 28
  for (const [k, v] of pairs) {
    page.drawText(`${k}:`, { x: 60, y: ky, size: 9, font: helvBold, color: TEXT })
    page.drawText(v, { x: 230, y: ky, size: 9, font: helv, color: TEXT })
    ky -= lineH
  }
}

function drawFooter(page: PDFPage, helv: PDFFont, width: number, label: string) {
  page.drawLine({ start: { x: 48, y: 44 }, end: { x: width - 48, y: 44 }, color: MUTED, thickness: 0.3 })
  const stamp = `${label}  ·  Generated ${new Date().toISOString().split('T')[0]}.`
  page.drawText(stamp, { x: 48, y: 28, size: 7, font: helv, color: MUTED })
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + '...' : s
}

// ────────────────────────────────────────────────────────────────────────
//  Main
// ────────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  console.info(`Writing extra test PDFs to ${OUT_DIR}\n`)

  const tasks: Array<[string, () => Promise<Uint8Array>, string]> = [
    [W2_2025.filename, () => buildW2(W2_2025), `W-2 ${W2_2025.taxYear} · wages ${formatUsd(W2_2025.wagesBox1)}`],
    [PAYSTUB_APR_2026.filename, () => buildPaystub(PAYSTUB_APR_2026), `Paystub Apr-2026 · YTD ${formatUsd(PAYSTUB_APR_2026.yearToDateGrossEarnings)}`],
    [BANK_STATEMENT.filename, () => buildBalanceStatement(BANK_STATEMENT), `Bank · ending ${formatUsd(BANK_STATEMENT.endingBalance)}`],
    [BROKERAGE_STATEMENT.filename, () => buildBalanceStatement(BROKERAGE_STATEMENT), `Brokerage · ending ${formatUsd(BROKERAGE_STATEMENT.endingBalance)}`],
    [RETIREMENT_STATEMENT.filename, () => buildBalanceStatement(RETIREMENT_STATEMENT), `Retirement · ending ${formatUsd(RETIREMENT_STATEMENT.endingBalance)}`],
    [MORTGAGE_STATEMENT.filename, () => buildLoanStatement(MORTGAGE_STATEMENT), `Mortgage · principal ${formatUsd(MORTGAGE_STATEMENT.principalBalance)}`],
    [AUTO_LOAN_STATEMENT.filename, () => buildLoanStatement(AUTO_LOAN_STATEMENT), `Auto Loan · principal ${formatUsd(AUTO_LOAN_STATEMENT.principalBalance)}`],
  ]

  for (const [filename, build, summary] of tasks) {
    const bytes = await build()
    const outPath = path.join(OUT_DIR, filename)
    fs.writeFileSync(outPath, bytes)
    console.info(`✅ ${filename.padEnd(38)} (${(bytes.length / 1024).toFixed(1).padStart(6)} KB)  ${summary}`)
  }

  console.info(`\nAll extra fixtures saved in ${OUT_DIR}.`)
  console.info(`Income path  → 1040 2024 + 1040 2025 + W-2 2025 + Paystub Apr-2026.`)
  console.info(`Net-worth    → Bank + Brokerage + Retirement = $1.95M; Auto loan -$35k → ≈$1.92M excluding primary residence.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
