/**
 * Certificate number format: AGF-{YYYY}-{6 upper alphanum}
 * Cryptographically random (nanoid-style) to avoid guessable sequences.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/1/I/O

export function generateCertificateNumber(): string {
  const year = new Date().getUTCFullYear()
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let suffix = ''
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length]
  return `AGF-${year}-${suffix}`
}
