-- Migration: 002_search_indexes.sql
-- Enables trigram fuzzy search and sets up GIN indexes + partial B-Tree SLA index

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Partial B-Tree index for SLA-eligible candidate scans
-- Highly selective: only indexes active, non-archived tickets that have an SLA deadline
CREATE INDEX IF NOT EXISTS idx_tickets_sla_eligible
  ON tickets ("slaDueAt" ASC, "primaryAssigneeId")
  WHERE status IN ('NEW', 'OPEN')
    AND "archivedAt" IS NULL
    AND "slaDueAt" IS NOT NULL;

-- GIN Trigram indexes for substring / wildcard search (ILIKE '%term%')
CREATE INDEX IF NOT EXISTS idx_tickets_subject_trgm
  ON tickets USING gin ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_requester_name_trgm
  ON tickets USING gin ("requesterName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_requester_email_trgm
  ON tickets USING gin ("requesterEmail" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_description_trgm
  ON tickets USING gin ("description" gin_trgm_ops);
