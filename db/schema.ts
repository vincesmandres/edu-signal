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
