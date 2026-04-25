-- 004_document_types.sql
-- Adds the new document types used by the K-1 supporting-docs slot (income
-- path), the entity-assets path, and the professional-credential path.
--
-- All four values are appended to the existing `document_type` enum. Safe
-- to re-run — each ADD VALUE is guarded with IF NOT EXISTS.
--
-- Run inside the Supabase SQL editor (or `npm run db:push:force` for dev).

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'k1';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'entity_financials';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'entity_formation';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'finra_credential';
