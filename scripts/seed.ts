import nextEnv from "@next/env";
import { closeDb, getDb } from "../db";
import { classrooms, enrollments, learningModules, students } from "../db/schema";

nextEnv.loadEnvConfig(process.cwd());

const ids = {
  student: "00000000-0000-4000-8000-000000000002",
  classroom: "00000000-0000-4000-8000-000000000003",
  enrollment: "00000000-0000-4000-8000-000000000004",
  module: "00000000-0000-4000-8000-000000000005",
};

const teacherId = process.env.SEED_TEACHER_ID ?? "";
const studentProfileId = process.env.SEED_STUDENT_PROFILE_ID;
if (!teacherId) throw new Error("SEED_TEACHER_ID is required and must be a Supabase Auth user UUID.");

async function seed() {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(students).values({
      id: ids.student,
      profileId: studentProfileId ?? null,
      displayName: "Student Demo",
      email: "student.demo@edu-signal.local",
    }).onConflictDoNothing();
    await tx.insert(classrooms).values({
      id: ids.classroom,
      name: "Física Demo",
      subject: "Física",
      academicPeriod: "2026",
      teacherId,
    }).onConflictDoNothing();
    await tx.insert(enrollments).values({
      id: ids.enrollment,
      studentId: ids.student,
      classroomId: ids.classroom,
    }).onConflictDoNothing();
    await tx.insert(learningModules).values({
      id: ids.module,
      classroomId: ids.classroom,
      title: "Movimiento en 2D",
      drivingQuestion: "¿Cómo podemos describir y predecir un movimiento en dos dimensiones?",
      methodologies: JSON.stringify(["ABP"]),
      phase: "draft",
    }).onConflictDoNothing();
  });
  console.log("Development seed applied.");
}

seed().catch((error) => {
  console.error("Database seed failed.", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => closeDb());
