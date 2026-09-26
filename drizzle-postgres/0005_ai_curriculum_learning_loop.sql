CREATE TABLE "activity_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_revision" integer DEFAULT 0 NOT NULL,
	"revision_limit" integer DEFAULT 2 NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_response_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"attempt_id" text NOT NULL,
	"revision" integer NOT NULL,
	"stage_responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_use_declaration" jsonb DEFAULT '{"used":false}'::jsonb NOT NULL,
	"evidence_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_rubrics" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"rubric_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_profile_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"request_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" uuid NOT NULL,
	"sanitized_input" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"model" text,
	"prompt_version" text,
	"draft" jsonb,
	"locked_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"approved_classroom_id" text,
	"completed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formative_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"response_version_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"feedback" jsonb,
	"proposed_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"model" text,
	"prompt_version" text,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"classroom_id" text NOT NULL,
	"teacher_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'validated' NOT NULL,
	"validation_summary" jsonb NOT NULL,
	"audit_reference" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" text PRIMARY KEY NOT NULL,
	"classroom_id" text NOT NULL,
	"student_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"raw_value" numeric(8, 2) NOT NULL,
	"normalized_percentage" numeric(5, 2) NOT NULL,
	"scale_snapshot" jsonb NOT NULL,
	"source_type" text NOT NULL,
	"source_review_id" text,
	"source_import_id" text,
	"supersedes_grade_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"corrected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_assessment_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"self_assessment_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" numeric(8, 2) NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"response_version_id" text NOT NULL,
	"confidence" integer NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" uuid NOT NULL,
	"classroom_id" text,
	"generation_id" text,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"extracted_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_review_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"score" numeric(8, 2) NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"response_version_id" text NOT NULL,
	"teacher_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"public_feedback" text,
	"private_notes" text,
	"required_improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "standards_framework" text;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "education_level" text;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "grade_scale_type" text DEFAULT 'numeric_100' NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "grade_scale_min" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "grade_scale_max" numeric(8, 2) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "grade_pass_threshold" numeric(8, 2) DEFAULT '60' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_activity_id_learning_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."learning_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_response_versions" ADD CONSTRAINT "activity_response_versions_attempt_id_activity_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."activity_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_response_versions" ADD CONSTRAINT "activity_response_versions_evidence_id_evidences_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_rubrics" ADD CONSTRAINT "activity_rubrics_activity_id_learning_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."learning_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_rubrics" ADD CONSTRAINT "activity_rubrics_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_records_actor_profile_id_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_generations" ADD CONSTRAINT "curriculum_generations_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_generations" ADD CONSTRAINT "curriculum_generations_approved_classroom_id_classrooms_id_fk" FOREIGN KEY ("approved_classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formative_feedback" ADD CONSTRAINT "formative_feedback_response_version_id_activity_response_versions_id_fk" FOREIGN KEY ("response_version_id") REFERENCES "public"."activity_response_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_imports" ADD CONSTRAINT "grade_imports_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_imports" ADD CONSTRAINT "grade_imports_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_source_review_id_teacher_reviews_id_fk" FOREIGN KEY ("source_review_id") REFERENCES "public"."teacher_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment_criteria" ADD CONSTRAINT "self_assessment_criteria_self_assessment_id_self_assessments_id_fk" FOREIGN KEY ("self_assessment_id") REFERENCES "public"."self_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment_criteria" ADD CONSTRAINT "self_assessment_criteria_criterion_id_rubric_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessments" ADD CONSTRAINT "self_assessments_response_version_id_activity_response_versions_id_fk" FOREIGN KEY ("response_version_id") REFERENCES "public"."activity_response_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_generation_id_curriculum_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."curriculum_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_review_criteria" ADD CONSTRAINT "teacher_review_criteria_review_id_teacher_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."teacher_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_review_criteria" ADD CONSTRAINT "teacher_review_criteria_criterion_id_rubric_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."rubric_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_response_version_id_activity_response_versions_id_fk" FOREIGN KEY ("response_version_id") REFERENCES "public"."activity_response_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_attempts_student_activity" ON "activity_attempts" USING btree ("student_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_attempts_activity_status" ON "activity_attempts" USING btree ("activity_id","status");--> statement-breakpoint
CREATE INDEX "idx_activity_attempts_student_status" ON "activity_attempts" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_response_versions_attempt_revision" ON "activity_response_versions" USING btree ("attempt_id","revision");--> statement-breakpoint
CREATE INDEX "idx_activity_response_versions_attempt_status" ON "activity_response_versions" USING btree ("attempt_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_rubrics_activity_rubric" ON "activity_rubrics" USING btree ("activity_id","rubric_id");--> statement-breakpoint
CREATE INDEX "idx_activity_rubrics_rubric" ON "activity_rubrics" USING btree ("rubric_id");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_actor_date" ON "ai_usage_records" USING btree ("actor_profile_id","request_date");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_feature_date" ON "ai_usage_records" USING btree ("feature","request_date");--> statement-breakpoint
CREATE INDEX "idx_curriculum_generations_teacher_created" ON "curriculum_generations" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_curriculum_generations_status" ON "curriculum_generations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_formative_feedback_response_version" ON "formative_feedback" USING btree ("response_version_id");--> statement-breakpoint
CREATE INDEX "idx_formative_feedback_status" ON "formative_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_grade_imports_classroom_created" ON "grade_imports" USING btree ("classroom_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_grade_imports_teacher_created" ON "grade_imports" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_grades_classroom_student" ON "grades" USING btree ("classroom_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_grades_target_status" ON "grades" USING btree ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "idx_grades_supersedes" ON "grades" USING btree ("supersedes_grade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_self_assessment_criterion" ON "self_assessment_criteria" USING btree ("self_assessment_id","criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_self_assessments_response_version" ON "self_assessments" USING btree ("response_version_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_materials_teacher_created" ON "teacher_materials" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_teacher_materials_classroom" ON "teacher_materials" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_materials_generation" ON "teacher_materials" USING btree ("generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teacher_review_criterion" ON "teacher_review_criteria" USING btree ("review_id","criterion_id");--> statement-breakpoint
CREATE INDEX "idx_teacher_reviews_response_status" ON "teacher_reviews" USING btree ("response_version_id","status");--> statement-breakpoint
CREATE INDEX "idx_teacher_reviews_teacher_created" ON "teacher_reviews" USING btree ("teacher_id","created_at");
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_source_import_id_grade_imports_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."grade_imports"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_supersedes_grade_id_grades_id_fk" FOREIGN KEY ("supersedes_grade_id") REFERENCES "public"."grades"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_grade_scale_check" CHECK (grade_scale_type IN ('numeric_5', 'numeric_10', 'numeric_100', 'rubric_levels') AND grade_scale_max > grade_scale_min AND grade_pass_threshold BETWEEN grade_scale_min AND grade_scale_max);
--> statement-breakpoint
ALTER TABLE "curriculum_generations" ADD CONSTRAINT "curriculum_generations_status_check" CHECK (status IN ('pending', 'completed', 'failed', 'approved'));
--> statement-breakpoint
ALTER TABLE "ai_usage_records" ADD CONSTRAINT "ai_usage_nonnegative_check" CHECK (input_tokens >= 0 AND output_tokens >= 0 AND total_tokens >= 0 AND total_tokens = input_tokens + output_tokens);
--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_owner_check" CHECK (classroom_id IS NOT NULL OR generation_id IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_size_check" CHECK (file_size > 0 AND file_size <= 20971520);
--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_extraction_status_check" CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'not_supported'));
--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_status_check" CHECK (status IN ('draft', 'submitted', 'returned', 'completed'));
--> statement-breakpoint
ALTER TABLE "activity_attempts" ADD CONSTRAINT "activity_attempts_revision_check" CHECK (revision_limit BETWEEN 0 AND 2 AND current_revision BETWEEN 0 AND revision_limit);
--> statement-breakpoint
ALTER TABLE "activity_response_versions" ADD CONSTRAINT "activity_response_versions_status_check" CHECK (status IN ('draft', 'submitted'));
--> statement-breakpoint
ALTER TABLE "activity_response_versions" ADD CONSTRAINT "activity_response_versions_revision_check" CHECK (revision BETWEEN 0 AND 2);
--> statement-breakpoint
ALTER TABLE "self_assessments" ADD CONSTRAINT "self_assessments_confidence_check" CHECK (confidence BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE "self_assessment_criteria" ADD CONSTRAINT "self_assessment_criteria_score_check" CHECK (score BETWEEN 0 AND 100);
--> statement-breakpoint
ALTER TABLE "formative_feedback" ADD CONSTRAINT "formative_feedback_status_check" CHECK (status IN ('pending', 'completed', 'failed'));
--> statement-breakpoint
ALTER TABLE "formative_feedback" ADD CONSTRAINT "formative_feedback_source_check" CHECK (source IN ('ai', 'teacher'));
--> statement-breakpoint
ALTER TABLE "teacher_reviews" ADD CONSTRAINT "teacher_reviews_status_check" CHECK (status IN ('draft', 'returned', 'published'));
--> statement-breakpoint
ALTER TABLE "teacher_review_criteria" ADD CONSTRAINT "teacher_review_criteria_score_check" CHECK (score BETWEEN 0 AND 100);
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_target_type_check" CHECK (target_type IN ('activity', 'module', 'classroom'));
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_status_check" CHECK (status IN ('draft', 'published', 'corrected'));
--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_normalized_check" CHECK (normalized_percentage BETWEEN 0 AND 100);
--> statement-breakpoint
ALTER TABLE "grade_imports" ADD CONSTRAINT "grade_imports_status_check" CHECK (status IN ('validated', 'confirmed', 'rejected'));
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_teacher_reviews_published_response" ON "teacher_reviews" ("response_version_id") WHERE "status" = 'published';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ai_loop_guard_response_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'submitted response versions are immutable';
  END IF;
  IF NEW.revision <> OLD.revision OR NEW.attempt_id <> OLD.attempt_id THEN
    RAISE EXCEPTION 'response version identity is immutable';
  END IF;
  IF NEW.status = 'submitted' AND NEW.submitted_at IS NULL THEN
    RAISE EXCEPTION 'submitted response versions require submitted_at';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER activity_response_versions_lifecycle BEFORE UPDATE ON "activity_response_versions" FOR EACH ROW EXECUTE FUNCTION public.ai_loop_guard_response_version();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ai_loop_block_submitted_response_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'submitted' THEN RAISE EXCEPTION 'submitted response versions cannot be deleted'; END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER activity_response_versions_delete_guard BEFORE DELETE ON "activity_response_versions" FOR EACH ROW EXECUTE FUNCTION public.ai_loop_block_submitted_response_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ai_loop_guard_generation_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = 'approved' THEN RAISE EXCEPTION 'approved generations are immutable'; END IF;
  IF NOT ((OLD.status = 'pending' AND NEW.status IN ('pending', 'completed', 'failed')) OR (OLD.status IN ('completed', 'failed') AND NEW.status IN ('pending', 'completed', 'failed', 'approved'))) THEN
    RAISE EXCEPTION 'invalid curriculum generation transition';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER curriculum_generations_lifecycle BEFORE UPDATE ON "curriculum_generations" FOR EACH ROW EXECUTE FUNCTION public.ai_loop_guard_generation_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ai_loop_guard_review_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status IN ('returned', 'published') THEN RAISE EXCEPTION 'finalized reviews are immutable'; END IF;
  IF OLD.status <> 'draft' OR NEW.status NOT IN ('draft', 'returned', 'published') THEN RAISE EXCEPTION 'invalid review transition'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER teacher_reviews_lifecycle BEFORE UPDATE ON "teacher_reviews" FOR EACH ROW EXECUTE FUNCTION public.ai_loop_guard_review_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ai_loop_guard_published_grade() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status IN ('published', 'corrected') THEN RAISE EXCEPTION 'published grades are append-only'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER grades_lifecycle BEFORE UPDATE OR DELETE ON "grades" FOR EACH ROW EXECUTE FUNCTION public.ai_loop_guard_published_grade();
