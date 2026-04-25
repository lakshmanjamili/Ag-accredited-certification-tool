/**
 * DOCX certificate generator — opens the AG-FinTax verification-letter DOCX
 * template, replaces bracket placeholders with real investor data, toggles
 * the correct qualification checkbox, and returns the resulting DOCX buffer.
 *
 * Uses PizZip directly (no docxtemplater) so we can do XML-aware replacement
 * against the vendor's literal-bracket placeholders. We preserve every Word
 * formatting detail — embedded logo, fonts, page layout, header/footer.
 *
 * Why the extra XML surgery: Word splits a line like "[November 10th, 2025]"
 * into several <w:r>/<w:t> runs (e.g. the "th" is a separate superscript run),
 * so a flat string replace on the XML can't see the placeholder as one token.
 * For every paragraph that contains a bracket placeholder, we concatenate the
 * paragraph's text, do the replacements, and rebuild it as a single run —
 * preserving the first run's fonts/color/size and the paragraph properties.
 */

import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import { mapPlaceholders, getCheckboxIndex, type LetterData } from '@/lib/placeholder-mapper'

const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'verification-letter.docx')

const UNCHECKED = '☐'
const CHECKED = '☑'

export function buildCertificateDocx(data: LetterData): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`DOCX template missing at ${TEMPLATE_PATH}`)
  }
  const buf = fs.readFileSync(TEMPLATE_PATH)
  const zip = new PizZip(buf)

  const placeholders = mapPlaceholders(data)
  // Pre-escape keys and values for matching against XML-escaped text.
  const escapedPlaceholders = Object.fromEntries(
    Object.entries(placeholders).map(([k, v]) => [xmlEscape(k), xmlEscape(v)]),
  )
  const checkboxIndex = getCheckboxIndex(data.path)

  const targetFiles = Object.keys(zip.files).filter(
    (name) =>
      name.endsWith('.xml') &&
      (name.includes('word/document') ||
        name.includes('word/header') ||
        name.includes('word/footer')),
  )

  for (const fileName of targetFiles) {
    let content = zip.files[fileName].asText()

    // 1. Flatten + replace placeholders inside any paragraph that contains them
    content = content.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (pXml) =>
      rewriteParagraph(pXml, escapedPlaceholders),
    )

    // 2. Toggle the correct checkbox
    content = updateCheckbox(content, checkboxIndex)

    zip.file(fileName, content)
  }

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

/**
 * If a paragraph's concatenated text contains any placeholder, rewrite its
 * runs: concatenate text across runs (so split placeholders like `[` / `name`
 * / `]` become matchable), run the placeholder map over the combined text,
 * then rebuild the runs — preserving soft line breaks (<w:br/>) and the
 * first run's formatting properties. Paragraphs with drawings, hyperlinks,
 * or tabs are left untouched (those don't contain placeholders in our
 * template).
 */
function rewriteParagraph(
  pXml: string,
  placeholders: Record<string, string>,
): string {
  // If paragraph is structurally complex, do nothing — the template doesn't
  // place bracketed placeholders inside those elements.
  if (
    pXml.includes('<w:drawing') ||
    pXml.includes('<w:tab/>') ||
    pXml.includes('<w:hyperlink')
  ) {
    return pXml
  }

  // Walk each run. Record text segments and <w:br/> breaks in order.
  const runRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g
  type Segment = { kind: 'text' | 'br'; content: string }
  const segments: Segment[] = []
  let firstRPr: string | null = null
  let m: RegExpExecArray | null
  while ((m = runRe.exec(pXml)) !== null) {
    const runBody = m[1]
    if (firstRPr === null) {
      const rPrMatch = runBody.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
      if (rPrMatch) firstRPr = rPrMatch[0]
    }
    // A single run may contain: optional <w:rPr>, 0..n <w:t>, and/or 1 <w:br/>
    const textMatch = runBody.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/)
    if (textMatch) segments.push({ kind: 'text', content: textMatch[1] })
    if (/<w:br\s*\/>/.test(runBody)) segments.push({ kind: 'br', content: '' })
  }
  if (segments.length === 0) return pXml

  // Use a sentinel char that cannot appear in placeholders or body text to
  // mark line-break positions while we run string replacement.
  const BREAK = '\u0001'
  const combined = segments
    .map((s) => (s.kind === 'br' ? BREAK : s.content))
    .join('')

  const hasPlaceholder = Object.keys(placeholders).some((k) => combined.includes(k))
  if (!hasPlaceholder) return pXml

  let newText = combined
  for (const [k, v] of Object.entries(placeholders)) {
    if (newText.includes(k)) newText = newText.split(k).join(v)
  }

  const lines = newText.split(BREAK)
  const rPr = firstRPr ?? ''

  const newRuns: string[] = []
  lines.forEach((line, i) => {
    if (i > 0) newRuns.push(`<w:r>${rPr}<w:br/></w:r>`)
    if (line) newRuns.push(`<w:r>${rPr}<w:t xml:space="preserve">${line}</w:t></w:r>`)
  })

  const pStartMatch = pXml.match(/^<w:p\b[^>]*>/)
  const pStart = pStartMatch ? pStartMatch[0] : '<w:p>'
  const pPrMatch = pXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)
  const pPr = pPrMatch ? pPrMatch[0] : ''

  return `${pStart}${pPr}${newRuns.join('')}</w:p>`
}

/**
 * Walk every unchecked-box occurrence in the XML and flip the Nth one
 * to a checked box. All other boxes remain unchecked.
 */
function updateCheckbox(xml: string, targetIndex: number): string {
  const parts = xml.split(UNCHECKED)
  if (parts.length <= 1) return xml
  return parts.reduce((acc, part, i) => {
    if (i === 0) return part
    const marker = i - 1 === targetIndex ? CHECKED : UNCHECKED
    return acc + marker + part
  }, '')
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
