/**
 * SEC Rule 501(a) thresholds — enforced exactly, no buffers.
 * Values stored in cents to avoid floating-point drift.
 */
export const SEC_THRESHOLDS = {
  INDIVIDUAL_INCOME_CENTS: 200_000_00,
  JOINT_INCOME_CENTS: 300_000_00,
  NET_WORTH_CENTS: 1_000_000_00,
  ENTITY_ASSETS_CENTS: 5_000_000_00, // Rule 501(a)(7) / (9)
} as const

export const CONFIDENCE_ESCALATION_THRESHOLD = 0.6

export const CERTIFICATE_VALIDITY_DAYS = {
  income: 90,
  net_worth: 365,
  professional: 365,
  entity_assets: 365,
} as const

export const STORAGE_PATHS = {
  submissionDocs: (submissionId: string) => `submissions/${submissionId}/docs`,
  certificatePdf: (submissionId: string, certNumber: string) =>
    `certificates/${submissionId}/${certNumber}.pdf`,
  certificateDocx: (submissionId: string, certNumber: string) =>
    `certificates/${submissionId}/${certNumber}.docx`,
  certificateSignature: (submissionId: string, certNumber: string) =>
    `certificates/${submissionId}/signatures/${certNumber}.png`,
  qr: (certNumber: string) => `qr/${certNumber}.png`,
} as const

export type SubmissionStatus =
  | 'draft'
  | 'pending_extraction'
  | 'pending_admin_review'
  | 'assigned'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'letter_generated'

export type VerificationPath = 'income' | 'net_worth' | 'professional' | 'entity_assets'

export type UserRole = 'customer' | 'admin'
