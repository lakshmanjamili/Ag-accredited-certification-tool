import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * auth.users is managed by Supabase. We only reference its id column so
 * Drizzle can enforce FKs. Do not write migrations against this schema.
 */
const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

// ─── Enums ──────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['customer', 'admin'])

export const submissionStatusEnum = pgEnum('submission_status', [
  'draft',
  'pending_extraction',
  'pending_admin_review',
  'assigned',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'letter_generated',
])

export const verificationPathEnum = pgEnum('verification_path', [
  'income',
  'net_worth',
  'professional',
  'entity_assets',
])

export const filingStatusEnum = pgEnum('filing_status', [
  'single',
  'mfj',
  'mfs',
  'hoh',
  'qss',
  'spousal_equivalent',
])

export const documentTypeEnum = pgEnum('document_type', [
  'form_1040',
  'w2',
  'paystub',
  'k1',
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
  'entity_financials',
  'entity_formation',
  'finra_credential',
  'other',
])

export const extractionStatusEnum = pgEnum('extraction_status', [
  'pending',
  'in_progress',
  'done',
  'failed',
])

export const decisionTypeEnum = pgEnum('decision_type', [
  'approve',
  'request_changes',
  'reject',
])

export const nwCategoryEnum = pgEnum('nw_category', ['asset', 'liability', 'adjustment'])

export const nwSubtypeEnum = pgEnum('nw_subtype', [
  'bank',
  'brokerage',
  'retirement',
  'real_estate',
  'business',
  'crypto',
  'life_insurance',
  'other_asset',
  'mortgage',
  'credit_card',
  'auto_loan',
  'student_loan',
  'other_loan',
  'primary_residence_excess',
])

export const ruleStatusEnum = pgEnum('rule_status', ['approved', 'rejected', 'manual_review'])

export const notificationTypeEnum = pgEnum('notification_type', [
  'submission_received',
  'changes_requested',
  'approved',
  'rejected',
  'letter_ready',
  'generic',
])

export const jobKindEnum = pgEnum('job_kind', ['extract', 'generate_letter', 'notify'])

export const jobStatusEnum = pgEnum('job_status', ['pending', 'in_progress', 'done', 'failed'])

// ─── Tables ─────────────────────────────────────────────────────────────

export const userProfile = pgTable('user_profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  fullName: text('full_name'),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('customer'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const adminProfile = pgTable('admin_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => userProfile.id, { onDelete: 'cascade' }),
  cpaLicenseNo: text('cpa_license_no'),
  title: text('title').default('CPA'),
  firmName: text('firm_name'),
  firmCity: text('firm_city'),
  firmEmail: text('firm_email'),
  jurisdiction: text('jurisdiction'),
  phone: text('phone'),
  typedSignatureBlock: text('typed_signature_block'),
  /** Storage path of CPA's saved signature PNG (optional) — lets admin
   *  one-click approve without redrawing each time. */
  signatureImagePath: text('signature_image_path'),
  defaultValidityDays: integer('default_validity_days'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const submission = pgTable(
  'submission',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => userProfile.id, { onDelete: 'cascade' }),
    status: submissionStatusEnum('status').notNull().default('draft'),
    verificationPath: verificationPathEnum('verification_path'),
    filingStatus: filingStatusEnum('filing_status'),
    taxYearPrimary: integer('tax_year_primary'),
    taxYearSecondary: integer('tax_year_secondary'),
    investorName: text('investor_name'),
    investorAddressLine1: text('investor_address_line1'),
    investorAddressLine2: text('investor_address_line2'),
    assignedAdminId: uuid('assigned_admin_id').references(() => userProfile.id),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    avgConfidence: text('avg_confidence'),
    customerAttestedAt: timestamp('customer_attested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('submission_status_idx').on(t.status),
    customerIdx: index('submission_customer_idx').on(t.customerId),
    assigneeIdx: index('submission_assignee_idx').on(t.assignedAdminId),
  }),
)

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submission.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    azureModelId: text('azure_model_id'),
    extractionStatus: extractionStatusEnum('extraction_status').notNull().default('pending'),
    confidence: text('confidence'),
    rawExtraction: jsonb('raw_extraction'),
    errorMessage: text('error_message'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
  },
  (t) => ({
    submissionIdx: index('document_submission_idx').on(t.submissionId),
  }),
)

export const extractedField = pgTable(
  'extracted_field',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submission.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').references(() => document.id, { onDelete: 'set null' }),
    key: text('key').notNull(),
    value: text('value'),
    originalValue: text('original_value'),
    confidence: text('confidence'),
    sourcePage: integer('source_page'),
    sourceBbox: jsonb('source_bbox'),
    editedByAdminId: uuid('edited_by_admin_id').references(() => userProfile.id),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    submissionIdx: index('ef_submission_idx').on(t.submissionId),
  }),
)

export const ruleEvaluation = pgTable('rule_evaluation', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submission.id, { onDelete: 'cascade' }),
  status: ruleStatusEnum('status').notNull(),
  path: verificationPathEnum('path').notNull(),
  ruleVersion: text('rule_version').notNull().default('v1-2026.04'),
  incomeYear1: bigint('income_year1_cents', { mode: 'number' }),
  incomeYear2: bigint('income_year2_cents', { mode: 'number' }),
  incomeYear3Est: bigint('income_year3_est_cents', { mode: 'number' }),
  netWorth: bigint('net_worth_cents', { mode: 'number' }),
  threshold: bigint('threshold_cents', { mode: 'number' }).notNull(),
  payStubConfirmed: boolean('pay_stub_confirmed').default(false),
  avgConfidence: text('avg_confidence'),
  reasons: jsonb('reasons').notNull().default(sql`'[]'::jsonb`),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const reviewDecision = pgTable('review_decision', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submission.id, { onDelete: 'cascade' }),
  adminId: uuid('admin_id')
    .notNull()
    .references(() => userProfile.id),
  decision: decisionTypeEnum('decision').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const netWorthLineItem = pgTable(
  'net_worth_line_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submission.id, { onDelete: 'cascade' }),
    category: nwCategoryEnum('category').notNull(),
    subtype: nwSubtypeEnum('subtype').notNull(),
    description: text('description').notNull(),
    valueCents: bigint('value_cents', { mode: 'number' }).notNull(),
    sourceDocumentId: uuid('source_document_id').references(() => document.id, {
      onDelete: 'set null',
    }),
    sourcePage: integer('source_page'),
    sourceBbox: jsonb('source_bbox'),
    createdBy: text('created_by').notNull(),
    editedByAdminId: uuid('edited_by_admin_id').references(() => userProfile.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    submissionIdx: index('nw_submission_idx').on(t.submissionId),
  }),
)

export const primaryResidenceInfo = pgTable('primary_residence_info', {
  submissionId: uuid('submission_id')
    .primaryKey()
    .references(() => submission.id, { onDelete: 'cascade' }),
  ownsResidence: boolean('owns_residence').notNull().default(false),
  fmvCents: bigint('fmv_cents', { mode: 'number' }),
  mortgageCents: bigint('mortgage_cents', { mode: 'number' }),
  mortgageChanged60d: boolean('mortgage_changed_60d').notNull().default(false),
  changeDescription: text('change_description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const certificate = pgTable(
  'certificate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submission.id, { onDelete: 'cascade' }),
    certificateNumber: text('certificate_number').notNull().unique(),
    path: verificationPathEnum('path').notNull(),
    pdfStoragePath: text('pdf_storage_path').notNull(),
    docxStoragePath: text('docx_storage_path'),
    signatureStoragePath: text('signature_storage_path').notNull(),
    qrStoragePath: text('qr_storage_path'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
    validThrough: timestamp('valid_through', { withTimezone: true }).notNull(),
    revoked: boolean('revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByAdminId: uuid('revoked_by_admin_id').references(() => userProfile.id),
    revocationReason: text('revocation_reason'),
    generatedByAdminId: uuid('generated_by_admin_id')
      .notNull()
      .references(() => userProfile.id),
    downloadCount: integer('download_count').notNull().default(0),
    lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
    snapshot: jsonb('snapshot'),
  },
  (t) => ({
    submissionIdx: index('cert_submission_idx').on(t.submissionId),
    numberIdx: index('cert_number_idx').on(t.certificateNumber),
  }),
)

export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => userProfile.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    relatedSubmissionId: uuid('related_submission_id').references(() => submission.id, {
      onDelete: 'cascade',
    }),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userReadIdx: index('notif_user_idx').on(t.userId, t.read),
  }),
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id'),
    diff: jsonb('diff'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    subjectIdx: index('audit_subject_idx').on(t.subjectType, t.subjectId),
  }),
)

export const job = pgTable(
  'job',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: jobKindEnum('kind').notNull(),
    payload: jsonb('payload').notNull(),
    status: jobStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('job_status_sched_idx').on(t.status, t.scheduledAt),
  }),
)

// ─── Inferred types for app code ────────────────────────────────────────

export type UserProfile = typeof userProfile.$inferSelect
export type NewUserProfile = typeof userProfile.$inferInsert
export type AdminProfile = typeof adminProfile.$inferSelect
export type Submission = typeof submission.$inferSelect
export type Document = typeof document.$inferSelect
export type ExtractedField = typeof extractedField.$inferSelect
export type RuleEvaluation = typeof ruleEvaluation.$inferSelect
export type ReviewDecision = typeof reviewDecision.$inferSelect
export type NetWorthLineItem = typeof netWorthLineItem.$inferSelect
export type PrimaryResidenceInfo = typeof primaryResidenceInfo.$inferSelect
export type Certificate = typeof certificate.$inferSelect
export type Notification = typeof notification.$inferSelect
export type AuditLog = typeof auditLog.$inferSelect
export type Job = typeof job.$inferSelect
