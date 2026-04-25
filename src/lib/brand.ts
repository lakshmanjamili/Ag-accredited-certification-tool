/**
 * AgFinTax brand tokens — in sync with globals.css and the Claude Design handoff.
 */
export const BRAND = {
  name: 'AgFinTax',
  wordmark: 'AgFinTax',
  legal: 'AgFinTax Advisors, LLC',
  tagline: 'SEC-compliant accredited investor verification in minutes, not hours or days.',

  // Core palette
  primary: '#0B1F3A', // ink
  primaryContainer: '#14335C',
  secondary: '#C9A227', // gold
  secondaryContainer: '#F5EFDC',
  surface: '#F7F3EC', // cream
  surfaceLow: '#FAFAF7', // bone
  paper: '#FFFFFF',
  onSurface: '#0F172A',
  onSurfaceVariant: '#475569',

  // Semantic
  success: '#15803D',
  warn: '#B45309',
  danger: '#B91C1C',

  // Typography
  fontSans: 'General Sans',
  fontSerif: 'Fraunces',
  fontHand: 'Homemade Apple',
} as const
