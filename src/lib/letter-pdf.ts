/**
 * PDF version of the AG FinTax accredited-investor verification letter —
 * visually matches the DOCX template so a recipient sees the same two-page
 * document whether they open the .pdf or the .docx.
 *
 * Page 1: Cover letter (date, investor name/address, salutation, body,
 *         "Sincerely, AG FinTax, LLC", encl line).
 * Page 2: ACCREDITED INVESTOR VERIFICATION LETTER (title, name, 7 criteria
 *         with the correct box ticked, CPA signature block).
 *
 * Uses pdf-lib only — no LibreOffice, no browser, runs in any runtime.
 */

import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import type { LetterPath } from '@/lib/placeholder-mapper'
import { CHECKBOX_BY_PATH, formatSalutation } from '@/lib/placeholder-mapper'

export type LetterPdfData = {
  certificateNumber: string
  path: LetterPath
  issuedAt: Date
  validThrough: Date
  investorName: string
  investorAddressLine1: string | null
  investorAddressLine2: string | null
  taxYearPrimary: number | null
  taxYearSecondary: number | null
  cpa: {
    name: string
    license: string
    title: string
    firm: string
    firmCity: string
    firmEmail: string
    jurisdiction?: string
  }
  /** PNG bytes of the CPA's hand-drawn or typed signature */
  signaturePng: Buffer | Uint8Array
}

const PAGE_W = 612 // 8.5"
const PAGE_H = 792 // 11"
const MARGIN_L = 72
const MARGIN_R = 72
const MARGIN_T = 72
const MARGIN_B = 72

const INK = rgb(0.043, 0.122, 0.227) // #0B1F3A
const ORANGE = rgb(0.863, 0.341, 0) // #DC5700
const BODY = rgb(0.141, 0.141, 0.141)
const MUTED = rgb(0.35, 0.38, 0.42)

const CRITERIA = [
  'an individual (not partnership, corporation, etc.) whose net worth, or joint net worth with his or her spouse, presently exceeds $1,000,000, exclusive of the value of his or her primary residence.',
  'an individual (not partnership, corporation, etc.) who had an income in excess of $200,000 in each of the past two most recent years, or joint income with his or her spouse in excess of $300,000 in each of those years and has reasonable expectations of reaching the same income level in the current year.',
  'an entity such as an Individual Retirement Account (IRA) or Self-Employed person (SEP) Retirement Account, and all beneficial owners meet one of the standards in bullets 1 and 2 above.',
  'an employee benefits plan within the meaning of Title 1 of ERISA and the plan has total assets in excess of $5,000,000.',
  'a corporation, partnership, Massachusetts business trust, or non-profit organization within the meaning of Section 501(c)(3) of the Internal Revenue Code with total assets in excess of $5,000,000.',
  'a business/entity/trust/LLC in which all equity owners are Accredited Investors; or',
  'a bank, insurance company, registered investment company, business development company, or small business investment company.',
]

export async function buildLetterPdf(data: LetterPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`AG FinTax Accredited Investor Verification — ${data.certificateNumber}`)
  pdf.setAuthor('AG FinTax Advisors, LLC')

  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helvItalic = await pdf.embedFont(StandardFonts.HelveticaOblique)

  let sigImg: PDFImage | null = null
  try {
    sigImg = await pdf.embedPng(data.signaturePng)
  } catch {
    sigImg = null
  }

  const yPrimary = data.taxYearPrimary ?? new Date().getUTCFullYear() - 1
  const yPrior = data.taxYearSecondary ?? yPrimary - 1

  // ─── Page 1: Cover Letter ─────────────────────────────────────────
  drawCoverLetter(pdf.addPage([PAGE_W, PAGE_H]), {
    helv,
    helvBold,
    helvItalic,
    data,
    yPrimary,
    yPrior,
  })

  // ─── Page 2: Accredited Investor Verification Letter ──────────────
  drawVerificationLetter(pdf.addPage([PAGE_W, PAGE_H]), {
    helv,
    helvBold,
    helvItalic,
    data,
    sigImg,
  })

  return pdf.save()
}

// ─── Page 1 ────────────────────────────────────────────────────────

function drawCoverLetter(
  page: import('pdf-lib').PDFPage,
  ctx: {
    helv: import('pdf-lib').PDFFont
    helvBold: import('pdf-lib').PDFFont
    helvItalic: import('pdf-lib').PDFFont
    data: LetterPdfData
    yPrimary: number
    yPrior: number
  },
) {
  const { helv, helvBold, data, yPrimary, yPrior } = ctx

  // Branded wordmark top-left (text-only; matches the real AG FinTax look)
  drawWordmark(page, helvBold, MARGIN_L, PAGE_H - MARGIN_T + 12, 22)

  // Date — right aligned
  const dateStr = formatLongDate(data.issuedAt)
  drawRightText(page, dateStr, PAGE_W - MARGIN_R, PAGE_H - MARGIN_T - 10, 11, helv, BODY)

  let y = PAGE_H - MARGIN_T - 70

  // Investor block
  page.drawText(data.investorName, { x: MARGIN_L, y, size: 11, font: helv, color: BODY })
  y -= 14
  if (data.investorAddressLine1) {
    page.drawText(data.investorAddressLine1, {
      x: MARGIN_L,
      y,
      size: 11,
      font: helv,
      color: BODY,
    })
    y -= 14
  }
  if (data.investorAddressLine2) {
    page.drawText(data.investorAddressLine2, {
      x: MARGIN_L,
      y,
      size: 11,
      font: helv,
      color: BODY,
    })
    y -= 14
  }

  y -= 12
  page.drawText(formatSalutation(data.investorName), {
    x: MARGIN_L,
    y,
    size: 11,
    font: helv,
    color: BODY,
  })
  y -= 24

  const bodyLineHeight = 14
  const textWidth = PAGE_W - MARGIN_L - MARGIN_R

  const paragraphs = [
    `The purpose of this letter is to confirm that we prepared the ${yPrimary} and ${yPrior} federal individual income tax returns of ${data.investorName} and delivered the completed returns to them for review and approval prior to electronic filing with the Internal Revenue Service (IRS).`,
    `The tax returns were prepared based on the information provided to us by ${data.investorName}. This information was neither audited nor independently verified by our firm. Accordingly, we make no representation and provide no assurance regarding the accuracy or completeness of the information supplied, or the sufficiency of these tax returns for any purpose other than filing with the IRS and applicable state or local tax authorities.`,
    `Our work was not intended to benefit or influence any third party, whether for purposes of obtaining credit or for any other reason. Therefore, you agree to indemnify and hold us harmless from any and all claims arising from the use of these tax returns or this letter for any purpose other than their intended tax filing use, regardless of the nature of the claim, including any arising from negligence by any party.`,
    `Any reliance upon the tax returns or this letter is solely at your own discretion and risk. This letter does not establish a client relationship with the recipient, nor does it create any obligation on our part to provide future information or services regarding ${data.investorName}.`,
  ]

  for (const p of paragraphs) {
    y = drawWrappedText(page, p, MARGIN_L, y, textWidth, 11, helv, BODY, bodyLineHeight)
    y -= 8
  }

  // Signature block
  y -= 24
  page.drawText('Sincerely,', { x: MARGIN_L, y, size: 11, font: helv, color: BODY })
  y -= 56
  page.drawText('AG FinTax, LLC', {
    x: MARGIN_L,
    y,
    size: 11,
    font: helvBold,
    color: INK,
  })
  y -= 20
  page.drawText('Encl.: Accredited Investor Verification Letter', {
    x: MARGIN_L,
    y,
    size: 10,
    font: helv,
    color: MUTED,
  })

  // Footer rule + tiny firm-address line
  page.drawLine({
    start: { x: MARGIN_L, y: MARGIN_B - 8 },
    end: { x: PAGE_W - MARGIN_R, y: MARGIN_B - 8 },
    color: rgb(0.8, 0.82, 0.86),
    thickness: 0.5,
  })
  page.drawText(
    '8195 S Custer Rd, Suite 200C, Frisco, TX 75035  ·  (469) 942-9888  ·  hello@agfintax.com',
    {
      x: MARGIN_L,
      y: MARGIN_B - 22,
      size: 8,
      font: helv,
      color: MUTED,
    },
  )
  page.drawText(`Certificate ${data.certificateNumber}`, {
    x: PAGE_W - MARGIN_R - 140,
    y: MARGIN_B - 22,
    size: 8,
    font: helv,
    color: MUTED,
  })
}

// ─── Page 2 ────────────────────────────────────────────────────────

function drawVerificationLetter(
  page: import('pdf-lib').PDFPage,
  ctx: {
    helv: import('pdf-lib').PDFFont
    helvBold: import('pdf-lib').PDFFont
    helvItalic: import('pdf-lib').PDFFont
    data: LetterPdfData
    sigImg: PDFImage | null
  },
) {
  const { helv, helvBold, helvItalic, data, sigImg } = ctx
  const checkedIndex = CHECKBOX_BY_PATH[data.path] ?? 1

  drawWordmark(page, helvBold, MARGIN_L, PAGE_H - MARGIN_T + 12, 22)

  let y = PAGE_H - MARGIN_T - 60

  // Title
  page.drawText('ACCREDITED INVESTOR VERIFICATION LETTER', {
    x: MARGIN_L,
    y,
    size: 14,
    font: helvBold,
    color: INK,
  })
  y -= 28

  // Name line
  page.drawText('Name of Investor: ', { x: MARGIN_L, y, size: 11, font: helv, color: BODY })
  const nameLabelWidth = helv.widthOfTextAtSize('Name of Investor: ', 11)
  page.drawText(`${data.investorName} (the "Investor")`, {
    x: MARGIN_L + nameLabelWidth,
    y,
    size: 11,
    font: helvBold,
    color: INK,
  })
  y -= 20

  // Jurisdiction + License # (filled in from CPA profile if available)
  const jurisdiction = data.cpa.jurisdiction?.trim() || '_________'
  const license = data.cpa.license?.trim() || '_________'
  const jurLine = `I am Licensed accountant   Jurisdiction: ${jurisdiction}   License #: ${license}`
  page.drawText(jurLine, { x: MARGIN_L, y, size: 11, font: helv, color: BODY })
  y -= 20

  const textWidth = PAGE_W - MARGIN_L - MARGIN_R

  const p1 =
    'I am in good standing in the jurisdiction(s) listed above and all jurisdictions in which I hold an active license. I hereby confirm the Investor is an "accredited investor" as defined in Rule 501 of Regulation D of the Securities Act of 1933.'
  y = drawWrappedText(page, p1, MARGIN_L, y, textWidth, 10.5, helv, BODY, 13.5)
  y -= 10

  const p2 =
    'In conducting the analysis, I reviewed information provided by the Investor, including certifications as to certain information and supporting documentation that the Investor provided to me. I have taken "reasonable steps" as outlined by the Securities and Exchange Commission in conducting the analysis.'
  y = drawWrappedText(page, p2, MARGIN_L, y, textWidth, 10.5, helv, BODY, 13.5)
  y -= 10

  y = drawWrappedText(
    page,
    'Based on the review of supporting documentation, I hereby attest the Investor satisfies one of the following criteria to qualify as an accredited investor:',
    MARGIN_L,
    y,
    textWidth,
    10.5,
    helv,
    BODY,
    13.5,
  )
  y -= 8

  // 7 criteria with checkboxes
  for (let i = 0; i < CRITERIA.length; i++) {
    const isChecked = i === checkedIndex
    y = drawCriterionRow(page, helv, helvBold, CRITERIA[i], y, textWidth, isChecked)
    y -= 6
  }

  // Closing statement
  y -= 4
  const closing =
    'I am pleased to confirm that the Investor has been verified an "accredited investor" as defined by Rule 501 of Regulation D of the Securities Act of 1933.'
  y = drawWrappedText(page, closing, MARGIN_L, y, textWidth, 10.5, helvItalic, BODY, 13.5)

  // Signature block
  y -= 24
  const sigBlockTop = y

  // Row 1: NAME
  page.drawText('NAME:', { x: MARGIN_L, y, size: 10.5, font: helvBold, color: INK })
  page.drawText(data.cpa.name || '_________________', {
    x: MARGIN_L + 52,
    y,
    size: 10.5,
    font: helv,
    color: BODY,
  })

  // Row 2: SIGNATURE + DATE
  y -= 36
  page.drawText('SIGNATURE:', { x: MARGIN_L, y, size: 10.5, font: helvBold, color: INK })
  // Signature line
  page.drawLine({
    start: { x: MARGIN_L + 78, y: y - 2 },
    end: { x: MARGIN_L + 250, y: y - 2 },
    color: BODY,
    thickness: 0.6,
  })
  if (sigImg) {
    const maxW = 160
    const maxH = 28
    const sw = sigImg.width
    const sh = sigImg.height
    const scale = Math.min(maxW / sw, maxH / sh)
    const drawW = sw * scale
    const drawH = sh * scale
    page.drawImage(sigImg, {
      x: MARGIN_L + 78 + (170 - drawW) / 2,
      y: y - 2,
      width: drawW,
      height: drawH,
    })
  }

  const dateX = MARGIN_L + 280
  page.drawText('DATE:', { x: dateX, y, size: 10.5, font: helvBold, color: INK })
  page.drawText(formatLongDate(data.issuedAt), {
    x: dateX + 42,
    y,
    size: 10.5,
    font: helv,
    color: BODY,
  })

  // Row 3: COMPANY
  y -= 28
  page.drawText('COMPANY:', { x: MARGIN_L, y, size: 10.5, font: helvBold, color: INK })
  page.drawText(data.cpa.firm || 'AG FINTAX, LLC', {
    x: MARGIN_L + 72,
    y,
    size: 10.5,
    font: helv,
    color: BODY,
  })

  // Row 4: TITLE (on its own line so long titles don't collide with COMPANY)
  y -= 22
  page.drawText('TITLE:', { x: MARGIN_L, y, size: 10.5, font: helvBold, color: INK })
  page.drawText(data.cpa.title || 'CPA', {
    x: MARGIN_L + 48,
    y,
    size: 10.5,
    font: helv,
    color: BODY,
  })

  void sigBlockTop

  // Footer
  page.drawLine({
    start: { x: MARGIN_L, y: MARGIN_B - 8 },
    end: { x: PAGE_W - MARGIN_R, y: MARGIN_B - 8 },
    color: rgb(0.8, 0.82, 0.86),
    thickness: 0.5,
  })
  page.drawText(
    'AG FinTax Advisors, LLC · hello@agfintax.com · (469) 942-9888',
    { x: MARGIN_L, y: MARGIN_B - 22, size: 8, font: helv, color: MUTED },
  )
  page.drawText(`Certificate ${data.certificateNumber}  ·  valid through ${formatLongDate(data.validThrough)}`, {
    x: PAGE_W - MARGIN_R - 240,
    y: MARGIN_B - 22,
    size: 8,
    font: helv,
    color: MUTED,
  })
}

// ─── Drawing helpers ───────────────────────────────────────────────

/**
 * Writes "AG FinTax" as two-colored text: orange "AG" + navy "FinTax",
 * no external logo file required.
 */
function drawWordmark(
  page: import('pdf-lib').PDFPage,
  boldFont: import('pdf-lib').PDFFont,
  x: number,
  y: number,
  size: number,
) {
  page.drawText('AG', { x, y, size, font: boldFont, color: ORANGE })
  const agW = boldFont.widthOfTextAtSize('AG', size)
  page.drawText(' FinTax', {
    x: x + agW,
    y,
    size,
    font: boldFont,
    color: INK,
  })
}

function drawCriterionRow(
  page: import('pdf-lib').PDFPage,
  font: import('pdf-lib').PDFFont,
  boldFont: import('pdf-lib').PDFFont,
  text: string,
  y: number,
  totalWidth: number,
  checked: boolean,
): number {
  const boxSize = 10
  const boxX = MARGIN_L
  const boxY = y - 9

  // Box
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    borderColor: INK,
    borderWidth: 0.7,
    color: checked ? INK : rgb(1, 1, 1),
  })
  if (checked) {
    page.drawText('X', {
      x: boxX + 2.2,
      y: boxY + 1.5,
      size: 8,
      font: boldFont,
      color: rgb(1, 1, 1),
    })
  }

  // Text after box
  const textX = boxX + boxSize + 8
  const textW = totalWidth - (boxSize + 8)
  return drawWrappedText(
    page,
    text,
    textX,
    y,
    textW,
    10.5,
    font,
    checked ? INK : BODY,
    13.5,
  )
}

function drawWrappedText(
  page: import('pdf-lib').PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: import('pdf-lib').PDFFont,
  color: ReturnType<typeof rgb>,
  lineHeight: number,
): number {
  const words = text.split(/\s+/)
  let line = ''
  let cursorY = y

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    const width = font.widthOfTextAtSize(test, size)
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color })
      cursorY -= lineHeight
      line = w
    } else {
      line = test
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size, font, color })
    cursorY -= lineHeight
  }
  return cursorY
}

function drawRightText(
  page: import('pdf-lib').PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: import('pdf-lib').PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - w, y, size, font, color })
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
