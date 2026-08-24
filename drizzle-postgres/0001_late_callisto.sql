ALTER TABLE "classrooms" DROP CONSTRAINT "classrooms_teacher_id_educators_id_fk";
--> statement-breakpoint
ALTER TABLE "credentials" DROP CONSTRAINT "credentials_issuer_id_educators_id_fk";
--> statement-breakpoint
ALTER TABLE "evaluations" DROP CONSTRAINT "evaluations_teacher_id_educators_id_fk";
--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "teacher_id" SET DATA TYPE uuid USING "teacher_id"::uuid;--> statement-breakpoint
ALTER TABLE "credentials" ALTER COLUMN "issuer_id" SET DATA TYPE uuid USING "issuer_id"::uuid;--> statement-breakpoint
ALTER TABLE "evaluations" ALTER COLUMN "teacher_id" SET DATA TYPE uuid USING "teacher_id"::uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issuer_id_profiles_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_teacher_id_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_profile_id_unique" UNIQUE("profile_id");
