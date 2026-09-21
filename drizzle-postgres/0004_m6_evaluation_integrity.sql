-- M6 enforces one evaluation per evidence. This migration intentionally fails
-- before creating the index when legacy data contains duplicates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "evaluations"
    GROUP BY "evidence_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'M6 preflight failed: duplicate evaluations exist per evidence_id';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_evaluations_evidence" ON "evaluations" ("evidence_id");
