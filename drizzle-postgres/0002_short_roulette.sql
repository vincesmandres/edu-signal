CREATE TABLE "activity_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"response" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"activity_type" text NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_activity_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_responses" ADD CONSTRAINT "activity_responses_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_responses" ADD CONSTRAINT "activity_responses_activity_id_learning_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."learning_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_activities" ADD CONSTRAINT "learning_activities_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_progress" ADD CONSTRAINT "student_activity_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_progress" ADD CONSTRAINT "student_activity_progress_activity_id_learning_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."learning_activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_responses_student_activity" ON "activity_responses" USING btree ("student_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_responses_student" ON "activity_responses" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_activity_responses_activity" ON "activity_responses" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "idx_activities_module_position" ON "learning_activities" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "idx_activities_module_status" ON "learning_activities" USING btree ("module_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_activity_progress_student_activity" ON "student_activity_progress" USING btree ("student_id","activity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_progress_student" ON "student_activity_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_activity_progress_activity" ON "student_activity_progress" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollments_student_classroom" ON "enrollments" USING btree ("student_id","classroom_id");