import { closeDb, getDb } from "../db";
import { classrooms, educators, enrollments, learningModules, students } from "../db/schema";

const ids = {
  educator: "00000000-0000-4000-8000-000000000001",
  student: "00000000-0000-4000-8000-000000000002",
  classroom: "00000000-0000-4000-8000-000000000003",
  enrollment: "00000000-0000-4000-8000-000000000004",
  module: "00000000-0000-4000-8000-000000000005",
};

async function seed() {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(educators).values({
      id: ids.educator,
      email: "teacher.demo@edu-signal.local",
      displayName: "Teacher Demo",
      role: "teacher",
    }).onConflictDoNothing();
    await tx.insert(students).values({
      id: ids.student,
      displayName: "Student Demo",
      email: "student.demo@edu-signal.local",
    }).onConflictDoNothing();
    await tx.insert(classrooms).values({
      id: ids.classroom,
      name: "Física Demo",
      subject: "Física",
      academicPeriod: "2026",
      teacherId: ids.educator,
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
