-- M5 relational schema changes. Supabase-specific RLS and Storage policies live in supabase/migrations/0007_m5_evidence_system.sql.
ALTER TABLE "learning_activities" ADD COLUMN IF NOT EXISTS "requires_evidence" boolean DEFAULT false NOT NULL;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "module_id" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "activity_id" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "evidence_type" text DEFAULT 'text' NOT NULL;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "text_content" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "external_url" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "file_name" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "evidences" ADD COLUMN IF NOT EXISTS "file_size" integer;
ALTER TABLE "evidences" DROP COLUMN IF EXISTS "kind";
ALTER TABLE "evidences" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "evidences" ALTER COLUMN "submitted_at" DROP DEFAULT;
ALTER TABLE "evidences" ALTER COLUMN "submitted_at" DROP NOT NULL;
UPDATE "evidences" SET "evidence_type" = CASE WHEN "storage_key" IS NOT NULL THEN 'file' ELSE 'text' END WHERE "evidence_type" IS NULL;
DO $$ BEGIN
  ALTER TABLE "evidences" ADD CONSTRAINT "evidences_status_check" CHECK ("status" IN ('draft', 'submitted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "evidences" ADD CONSTRAINT "evidences_type_check" CHECK ("evidence_type" IN ('text', 'file', 'link'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "idx_evidences_module" ON "evidences" ("module_id");
CREATE INDEX IF NOT EXISTS "idx_evidences_activity" ON "evidences" ("activity_id");
CREATE INDEX IF NOT EXISTS "idx_evidences_status" ON "evidences" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_evidences_student_activity" ON "evidences" ("student_id", "activity_id") WHERE "activity_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION "validate_evidence_lifecycle"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN RAISE EXCEPTION 'submitted evidence is immutable'; END IF;
  IF NEW.status = 'submitted' THEN
    IF NEW.evidence_type = 'text' AND NULLIF(btrim(NEW.text_content), '') IS NULL THEN RAISE EXCEPTION 'submitted text evidence requires text_content'; END IF;
    IF NEW.evidence_type = 'link' AND (NEW.external_url IS NULL OR NEW.external_url !~ '^https://') THEN RAISE EXCEPTION 'submitted link evidence requires an HTTPS URL'; END IF;
    IF NEW.evidence_type = 'file' AND NULLIF(btrim(NEW.storage_key), '') IS NULL THEN RAISE EXCEPTION 'submitted file evidence requires storage_key'; END IF;
  END IF;
  IF NEW.activity_id IS NOT NULL AND NEW.module_id IS NULL THEN RAISE EXCEPTION 'activity-backed evidence requires module_id'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "evidence_lifecycle_guard" ON "evidences";
CREATE TRIGGER "evidence_lifecycle_guard" BEFORE INSERT OR UPDATE ON "evidences" FOR EACH ROW EXECUTE FUNCTION "validate_evidence_lifecycle"();
