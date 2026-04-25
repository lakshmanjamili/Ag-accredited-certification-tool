import { z } from 'zod'

export const filingStatusSchema = z.enum([
  'single',
  'mfj',
  'mfs',
  'hoh',
  'qss',
  'spousal_equivalent',
])

export const verificationPathSchema = z.enum(['income', 'net_worth', 'professional'])

export const documentTypeSchema = z.enum([
  'form_1040',
  'w2',
  'paystub',
  'bank_statement',
  'brokerage_statement',
  'retirement_statement',
  'real_estate',
  'business_ownership',
  'crypto_wallet',
  'life_insurance',
  'mortgage_statement',
  'credit_card_statement',
  'loan_statement',
  'other',
])

export const createSubmissionSchema = z.object({
  verificationPath: verificationPathSchema,
  filingStatus: filingStatusSchema.optional(),
})

export const submitForReviewSchema = z.object({
  submissionId: z.string().uuid(),
  attested: z.literal(true),
})

export const uploadDocumentSchema = z.object({
  submissionId: z.string().uuid(),
  type: documentTypeSchema,
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
})

export const primaryResidenceSchema = z.object({
  submissionId: z.string().uuid(),
  ownsResidence: z.boolean(),
  fmvCents: z.number().int().nonnegative().nullable(),
  mortgageCents: z.number().int().nonnegative().nullable(),
  mortgageChanged60d: z.boolean(),
  changeDescription: z.string().optional(),
})
