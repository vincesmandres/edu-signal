import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const educators = sqliteTable("educators", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("teacher"),
  ...timestamps,
}, (table) => [index("idx_educators_email").on(table.email)]);

export const classrooms = sqliteTable("classrooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  academicPeriod: text("academic_period").notNull(),
  teacherId: text("teacher_id").notNull().references(() => educators.id),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [index("idx_classrooms_teacher_created").on(table.teacherId, table.createdAt)]);

export const learningModules = sqliteTable("learning_modules", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  title: text("title").notNull(),
  drivingQuestion: text("driving_question").notNull(),
  methodologies: text("methodologies").notNull(),
  phase: text("phase").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_modules_classroom_created").on(table.classroomId, table.createdAt)]);

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull().references(() => learningModules.id),
  title: text("title").notNull(),
  format: text("format").notNull(),
  criteria: text("criteria").notNull(),
  ...timestamps,
}, (table) => [index("idx_assessments_module_created").on(table.moduleId, table.createdAt)]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  externalRef: text("external_ref"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => [index("idx_students_email").on(table.email)]);

export const enrollments = sqliteTable("enrollments", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  status: text("status").notNull().default("active"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (table) => [
  index("idx_enrollments_student").on(table.studentId),
  index("idx_enrollments_classroom").on(table.classroomId),
]);

export const rubrics = sqliteTable("rubrics", {
  id: text("id").primaryKey(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_rubrics_classroom_created").on(table.classroomId, table.createdAt)]);

export const rubricCriteria = sqliteTable("rubric_criteria", {
  id: text("id").primaryKey(),
  rubricId: text("rubric_id").notNull().references(() => rubrics.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  maxScore: text("max_score").notNull().default("4"),
  position: text("position").notNull().default("0"),
  ...timestamps,
}, (table) => [index("idx_rubric_criteria_rubric").on(table.rubricId, table.position)]);

export const evidences = sqliteTable("evidences", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("project"),
  storageKey: text("storage_key"),
  status: text("status").notNull().default("submitted"),
  submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (table) => [
  index("idx_evidences_student_created").on(table.studentId, table.createdAt),
  index("idx_evidences_classroom_created").on(table.classroomId, table.createdAt),
]);

export const evaluations = sqliteTable("evaluations", {
  id: text("id").primaryKey(),
  evidenceId: text("evidence_id").notNull().references(() => evidences.id),
  rubricId: text("rubric_id").references(() => rubrics.id),
  teacherId: text("teacher_id").notNull().references(() => educators.id),
  score: text("score"),
  feedback: text("feedback"),
  status: text("status").notNull().default("draft"),
  ...timestamps,
}, (table) => [index("idx_evaluations_evidence_created").on(table.evidenceId, table.createdAt)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"),
  ...timestamps,
}, (table) => [index("idx_audit_actor_created").on(table.actorId, table.createdAt)]);
