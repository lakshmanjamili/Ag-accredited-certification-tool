/**
 * Ledger-aesthetic icon set — 1.5px stroke Lucide-style to match the
 * sophisticated editorial feel. Re-exports Lucide icons with the right
 * defaults and adds a couple of bespoke ones.
 */

import {
  ShieldCheck as LShieldCheck,
  Lock as LLock,
  CheckCircle2 as LCheckCircle2,
  ArrowRight as LArrowRight,
  FileCheck as LFileCheck,
  Clock as LClock,
  type LucideProps,
} from 'lucide-react'

type Props = LucideProps

const base = { strokeWidth: 1.5 }

export const ShieldCheck = (p: Props) => <LShieldCheck {...base} {...p} />
export const Lock = (p: Props) => <LLock {...base} {...p} />
export const CheckCircle2 = (p: Props) => <LCheckCircle2 {...base} {...p} />
export const ArrowRight = (p: Props) => <LArrowRight {...base} {...p} />
export const FileCheck = (p: Props) => <LFileCheck {...base} {...p} />
export const Clock = (p: Props) => <LClock {...base} {...p} />

export const VerifiedDocument = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="m9 15 2 2 4-4" />
  </svg>
)

export const AccountBalance = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 9.5 12 4l9 5.5" />
    <path d="M5 10v7" />
    <path d="M9 10v7" />
    <path d="M15 10v7" />
    <path d="M19 10v7" />
    <path d="M3 20h18" />
  </svg>
)

export const QuoteIcon = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M7.17 17q-1.34 0-2.25-.89Q4 15.21 4 13.88q0-1.12.43-2.43.43-1.31 1.41-2.79.98-1.48 2.59-2.96L9.8 6.86q-1.1 1.11-1.83 2.18-.73 1.06-.98 2.03l.7.2q.58.17 1 .67.42.5.42 1.27 0 .95-.65 1.62-.65.67-1.29.67Zm8 0q-1.34 0-2.25-.89-.92-.9-.92-2.23 0-1.12.43-2.43.43-1.31 1.41-2.79.98-1.48 2.59-2.96l1.37 1.16q-1.1 1.11-1.83 2.18-.73 1.06-.98 2.03l.7.2q.58.17 1 .67.42.5.42 1.27 0 .95-.65 1.62-.65.67-1.29.67Z" />
  </svg>
)
