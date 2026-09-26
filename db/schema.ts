import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
};

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("student"),
  ...timestamps,
});

export const educators = pgTable("educators", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("teacher"),
  ...timestamps,
}, (table) => [index("idx_educators_email").on(table.email), uniqueIndex("uq_educators_email").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  educatorId: text("educator_id").notNull().references(() => educators.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  ...timestamps,
}, (table) => [index("idx_sessions_educator").on(table.educatorId), index("idx_sessions_expiry").on(table.expiresAt)]);

export const classrooms = pgTable("classrooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  academicPeriod: text("academic_period").notNull(),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  status: text("status").notNull().default("active"),
  country: text("country"),
  standardsFramework: text("standards_framework"),
  educationLevel: text("education_level"),
  gradeScaleType: text("grade_scale_type").notNull().default("numeric_100"),
  gradeScaleMin: numeric("grade_scale_min", { precision: 8, scale: 2 }).notNull().default("0"),
  gradeScaleMax: numeric("grade_scale_max", { precision: 8, scale: 2 }).notNull().default("100"),
  gradePassThreshold: numeric("grade_pass_threshold", { precision: 8, scale: 2 }).notNull().default("60"),
  ...timestamps,
}, (table) => [index("idx_classrooms_teacher_created").on(table.teacherId, table.createdAt)]);

export const learningModules = pgTable("learning_modules", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  title: text("title").notNull(),
  drivingQuestion: text("driving_question").notNull(),
  methodologies: text("methodologies").notNull(),
  phase: text("phase").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_modules_classroom_created").on(table.classroomId, table.createdAt)]);

export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => learningModules.id),
  title: text("title").notNull(),
  format: text("format").notNull(),
  criteria: text("criteria").notNull(),
  ...timestamps,
}, (table) => [index("idx_assessments_module_created").on(table.moduleId, table.createdAt)]);

export const students = pgTable("students", {
  id: text("id").primaryKey(),
  profileId: uuid("profile_id").unique().references(() => profiles.id),
  displayName: text("display_name").notNull(),
  email: text("email"),
  externalRef: text("external_ref"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [index("idx_students_email").on(table.email)]);

export const enrollments = pgTable("enrollments", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  ...timestamps,
}, (table) => [
  index("idx_enrollments_student").on(table.studentId),
  index("idx_enrollments_classroom").on(table.classroomId),
  uniqueIndex("uq_enrollments_student_classroom").on(table.studentId, table.classroomId),
]);

export const learningActivities = pgTable("learning_activities", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => learningModules.id),
  title: text("title").notNull(),
  instructions: text("instructions").notNull().default(""),
  activityType: text("activity_type").notNull(),
  position: integer("position").notNull().default(1),
  required: boolean("required").notNull().default(true),
  requiresEvidence: boolean("requires_evidence").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [
  index("idx_activities_module_position").on(table.moduleId, table.position),
  index("idx_activities_module_status").on(table.moduleId, table.status),
]);

export const activityResponses = pgTable("activity_responses", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  activityId: text("activity_id").notNull().references(() => learningActivities.id),
  response: text("response").notNull(),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [
  uniqueIndex("uq_activity_responses_student_activity").on(table.studentId, table.activityId),
  index("idx_activity_responses_student").on(table.studentId),
  index("idx_activity_responses_activity").on(table.activityId),
]);

export const studentActivityProgress = pgTable("student_activity_progress", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  activityId: text("activity_id").notNull().references(() => learningActivities.id),
  status: text("status").notNull().default("not_started"),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [
  uniqueIndex("uq_activity_progress_student_activity").on(table.studentId, table.activityId),
  index("idx_activity_progress_student").on(table.studentId),
  index("idx_activity_progress_activity").on(table.activityId),
]);

export const rubrics = pgTable("rubrics", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_rubrics_classroom_created").on(table.classroomId, table.createdAt)]);

export const rubricCriteria = pgTable("rubric_criteria", {
  id: text("id").primaryKey(),
  rubricId: text("rubric_id").notNull().references(() => rubrics.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  maxScore: text("max_score").notNull().default("4"),
  position: text("position").notNull().default("0"),
  ...timestamps,
}, (table) => [index("idx_rubric_criteria_rubric").on(table.rubricId, table.position)]);

export const evidences = pgTable("evidences", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  moduleId: text("module_id").references(() => learningModules.id),
  activityId: text("activity_id").references(() => learningActivities.id),
  title: text("title").notNull(),
  description: text("description"),
  evidenceType: text("evidence_type").notNull().default("text"),
  textContent: text("text_content"),
  externalUrl: text("external_url"),
  storageKey: text("storage_key"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [
  index("idx_evidences_student_created").on(table.studentId, table.createdAt),
  index("idx_evidences_classroom_created").on(table.classroomId, table.createdAt),
  index("idx_evidences_module").on(table.moduleId),
  index("idx_evidences_activity").on(table.activityId),
  index("idx_evidences_status").on(table.status),
  uniqueIndex("uq_evidences_student_activity").on(table.studentId, table.activityId).where(sql`${table.activityId} is not null`),
]);

export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  evidenceId: text("evidence_id").notNull().references(() => evidences.id),
  rubricId: text("rubric_id").references(() => rubrics.id),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  score: text("score"),
  feedback: text("feedback"),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_evaluations_evidence_created").on(table.evidenceId, table.createdAt), uniqueIndex("uq_evaluations_evidence").on(table.evidenceId)]);

export const evaluationScores = pgTable("evaluation_scores", {
  id: text("id").primaryKey(),
  evaluationId: text("evaluation_id").notNull().references(() => evaluations.id),
  criterionId: text("criterion_id").notNull().references(() => rubricCriteria.id),
  score: text("score").notNull(),
  feedback: text("feedback"),
  ...timestamps,
}, (table) => [index("idx_evaluation_scores_evaluation").on(table.evaluationId)]);

export const credentials = pgTable("credentials", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  issuerId: uuid("issuer_id").notNull().references(() => profiles.id),
  title: text("title").notNull(),
  achievement: text("achievement").notNull(),
  verificationCode: text("verification_code").notNull().unique(),
  credentialJson: text("credential_json").notNull(),
  status: text("status").notNull().default("issued"),
  issuedAt: timestamp("issued_at", { withTimezone: true, mode: "string" }).notNull().default(sql`now()`),
  ...timestamps,
}, (table) => [index("idx_credentials_student_issued").on(table.studentId, table.issuedAt)]);

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"),
  ...timestamps,
}, (table) => [index("idx_audit_actor_created").on(table.actorId, table.createdAt)]);

export const curriculumGenerations = pgTable("curriculum_generations", {
  id: text("id").primaryKey(),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  sanitizedInput: jsonb("sanitized_input").notNull(),
  status: text("status").notNull().default("pending"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  draft: jsonb("draft"),
  lockedSections: jsonb("locked_sections").notNull().default([]),
  usage: jsonb("usage").notNull().default({}),
  errorCode: text("error_code"),
  approvedClassroomId: text("approved_classroom_id").references(() => classrooms.id),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  approvedAt: timestamp("approved_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [index("idx_curriculum_generations_teacher_created").on(table.teacherId, table.createdAt), index("idx_curriculum_generations_status").on(table.status)]);

export const aiUsageRecords = pgTable("ai_usage_records", {
  id: text("id").primaryKey(),
  actorProfileId: uuid("actor_profile_id").notNull().references(() => profiles.id),
  feature: text("feature").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  requestDate: text("request_date").notNull(),
  ...timestamps,
}, (table) => [index("idx_ai_usage_actor_date").on(table.actorProfileId, table.requestDate), index("idx_ai_usage_feature_date").on(table.feature, table.requestDate)]);

export const teacherMaterials = pgTable("teacher_materials", {
  id: text("id").primaryKey(),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  classroomId: text("classroom_id").references(() => classrooms.id),
  generationId: text("generation_id").references(() => curriculumGenerations.id),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractedText: text("extracted_text"),
  ...timestamps,
}, (table) => [index("idx_teacher_materials_teacher_created").on(table.teacherId, table.createdAt), index("idx_teacher_materials_classroom").on(table.classroomId), index("idx_teacher_materials_generation").on(table.generationId)]);

export const activityRubrics = pgTable("activity_rubrics", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull().references(() => learningActivities.id),
  rubricId: text("rubric_id").notNull().references(() => rubrics.id),
  ...timestamps,
}, (table) => [uniqueIndex("uq_activity_rubrics_activity_rubric").on(table.activityId, table.rubricId), index("idx_activity_rubrics_rubric").on(table.rubricId)]);

export const activityAttempts = pgTable("activity_attempts", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  activityId: text("activity_id").notNull().references(() => learningActivities.id),
  status: text("status").notNull().default("draft"),
  currentRevision: integer("current_revision").notNull().default(0),
  revisionLimit: integer("revision_limit").notNull().default(2),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [uniqueIndex("uq_activity_attempts_student_activity").on(table.studentId, table.activityId), index("idx_activity_attempts_activity_status").on(table.activityId, table.status), index("idx_activity_attempts_student_status").on(table.studentId, table.status)]);

export const activityResponseVersions = pgTable("activity_response_versions", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => activityAttempts.id),
  revision: integer("revision").notNull(),
  stageResponses: jsonb("stage_responses").notNull().default({}),
  aiUseDeclaration: jsonb("ai_use_declaration").notNull().default({ used: false }),
  evidenceId: text("evidence_id").references(() => evidences.id),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [uniqueIndex("uq_activity_response_versions_attempt_revision").on(table.attemptId, table.revision), index("idx_activity_response_versions_attempt_status").on(table.attemptId, table.status)]);

export const selfAssessments = pgTable("self_assessments", {
  id: text("id").primaryKey(),
  responseVersionId: text("response_version_id").notNull().references(() => activityResponseVersions.id),
  confidence: integer("confidence").notNull(),
  rationale: text("rationale").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("uq_self_assessments_response_version").on(table.responseVersionId)]);

export const selfAssessmentCriteria = pgTable("self_assessment_criteria", {
  id: text("id").primaryKey(),
  selfAssessmentId: text("self_assessment_id").notNull().references(() => selfAssessments.id),
  criterionId: text("criterion_id").notNull().references(() => rubricCriteria.id),
  score: numeric("score", { precision: 8, scale: 2 }).notNull(),
  rationale: text("rationale").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("uq_self_assessment_criterion").on(table.selfAssessmentId, table.criterionId)]);

export const formativeFeedback = pgTable("formative_feedback", {
  id: text("id").primaryKey(),
  responseVersionId: text("response_version_id").notNull().references(() => activityResponseVersions.id),
  status: text("status").notNull().default("pending"),
  feedback: jsonb("feedback"),
  proposedScores: jsonb("proposed_scores").notNull().default([]),
  source: text("source").notNull().default("ai"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  usage: jsonb("usage").notNull().default({}),
  errorCode: text("error_code"),
  ...timestamps,
}, (table) => [uniqueIndex("uq_formative_feedback_response_version").on(table.responseVersionId), index("idx_formative_feedback_status").on(table.status)]);

export const teacherReviews = pgTable("teacher_reviews", {
  id: text("id").primaryKey(),
  responseVersionId: text("response_version_id").notNull().references(() => activityResponseVersions.id),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  status: text("status").notNull().default("draft"),
  publicFeedback: text("public_feedback"),
  privateNotes: text("private_notes"),
  requiredImprovements: jsonb("required_improvements").notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  returnedAt: timestamp("returned_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [index("idx_teacher_reviews_response_status").on(table.responseVersionId, table.status), index("idx_teacher_reviews_teacher_created").on(table.teacherId, table.createdAt)]);

export const teacherReviewCriteria = pgTable("teacher_review_criteria", {
  id: text("id").primaryKey(),
  reviewId: text("review_id").notNull().references(() => teacherReviews.id),
  criterionId: text("criterion_id").notNull().references(() => rubricCriteria.id),
  score: numeric("score", { precision: 8, scale: 2 }).notNull(),
  feedback: text("feedback"),
  ...timestamps,
}, (table) => [uniqueIndex("uq_teacher_review_criterion").on(table.reviewId, table.criterionId)]);

export const grades = pgTable("grades", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  studentId: text("student_id").notNull().references(() => students.id),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  rawValue: numeric("raw_value", { precision: 8, scale: 2 }).notNull(),
  normalizedPercentage: numeric("normalized_percentage", { precision: 5, scale: 2 }).notNull(),
  scaleSnapshot: jsonb("scale_snapshot").notNull(),
  sourceType: text("source_type").notNull(),
  sourceReviewId: text("source_review_id").references(() => teacherReviews.id),
  sourceImportId: text("source_import_id"),
  supersedesGradeId: text("supersedes_grade_id"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  correctedAt: timestamp("corrected_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [index("idx_grades_classroom_student").on(table.classroomId, table.studentId), index("idx_grades_target_status").on(table.targetType, table.targetId, table.status), index("idx_grades_supersedes").on(table.supersedesGradeId)]);

export const gradeImports = pgTable("grade_imports", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  teacherId: uuid("teacher_id").notNull().references(() => profiles.id),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("validated"),
  validationSummary: jsonb("validation_summary").notNull(),
  auditReference: text("audit_reference"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "string" }),
  ...timestamps,
}, (table) => [index("idx_grade_imports_classroom_created").on(table.classroomId, table.createdAt), index("idx_grade_imports_teacher_created").on(table.teacherId, table.createdAt)]);
