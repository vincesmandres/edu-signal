import nextEnv from "@next/env";
import { closeDb, getDb } from "../db";
import { classrooms, enrollments, learningActivities, learningModules, students } from "../db/schema";

nextEnv.loadEnvConfig(process.cwd());

const teacherId = process.env.SEED_TEACHER_ID ?? "";
const studentAId = process.env.SEED_STUDENT_A_PROFILE_ID;
const studentBId = process.env.SEED_STUDENT_B_PROFILE_ID;
if (!teacherId || !studentAId || !studentBId) throw new Error("SEED_TEACHER_ID, SEED_STUDENT_A_PROFILE_ID and SEED_STUDENT_B_PROFILE_ID are required.");

const ids = { studentA: "m4-student-a", studentB: "m4-student-b", classroomA: "m4-classroom-a", classroomB: "m4-classroom-b", moduleA: "m4-module-a", moduleB: "m4-module-b" };

async function seed() {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(students).values([{ id: ids.studentA, profileId: studentAId, displayName: "Student A", email: null }, { id: ids.studentB, profileId: studentBId, displayName: "Student B", email: null }]).onConflictDoNothing();
    await tx.insert(classrooms).values([{ id: ids.classroomA, name: "Física Demo A", subject: "Física", academicPeriod: "2026", teacherId }, { id: ids.classroomB, name: "Física Demo B", subject: "Física", academicPeriod: "2026", teacherId }]).onConflictDoNothing();
    await tx.insert(enrollments).values([{ id: "m4-enrollment-a", studentId: ids.studentA, classroomId: ids.classroomA }, { id: "m4-enrollment-b", studentId: ids.studentB, classroomId: ids.classroomB }]).onConflictDoNothing();
    await tx.insert(learningModules).values([{ id: ids.moduleA, classroomId: ids.classroomA, title: "Movimiento en 2D", drivingQuestion: "¿Cómo podemos predecir una trayectoria?", methodologies: JSON.stringify(["PhET", "ABP"]), phase: "published" }, { id: "m4-module-a-draft", classroomId: ids.classroomA, title: "Leyes de Newton", drivingQuestion: "¿Qué fuerzas actúan?", methodologies: JSON.stringify(["ABP"]), phase: "draft" }, { id: ids.moduleB, classroomId: ids.classroomB, title: "Energía", drivingQuestion: "¿Cómo se transforma la energía?", methodologies: JSON.stringify(["ABR"]), phase: "published" }]).onConflictDoNothing();
    const activities = [
      { id: "m4-activity-prediction", moduleId: ids.moduleA, title: "Predicción inicial", instructions: "Escribe tu idea antes de explorar.", activityType: "prediction", position: 1, config: { prompt: "¿Qué crees que ocurrirá si duplicamos la velocidad?" }, status: "published" },
      { id: "m4-activity-simulation", moduleId: ids.moduleA, title: "Explora la simulación", instructions: "Explora el recurso y observa el movimiento.", activityType: "simulation", position: 2, config: { provider: "phet", url: "https://phet.colorado.edu/", label: "Abrir simulación" }, status: "published" },
      { id: "m4-activity-question", moduleId: ids.moduleA, title: "Explica lo observado", instructions: "Relaciona tu observación con la pregunta guía.", activityType: "question", position: 3, config: { prompt: "¿Qué observaste?", responseType: "long_text" }, status: "published" },
      { id: "m4-activity-reflection", moduleId: ids.moduleA, title: "Compara", instructions: "Vuelve sobre tu predicción.", activityType: "reflection", position: 4, config: { prompt: "¿Qué cambió entre tu predicción y lo observado?" }, status: "published" },
      { id: "m4-activity-draft", moduleId: ids.moduleA, title: "Actividad futura", instructions: "Todavía no disponible.", activityType: "question", position: 5, config: { prompt: "Pregunta futura", responseType: "short_text" } },
      { id: "m4-activity-b", moduleId: ids.moduleB, title: "Explora energía", instructions: "Actividad de otra aula.", activityType: "instruction", position: 1, config: { content: "Observa el recurso." }, status: "published" },
    ];
    await tx.insert(learningActivities).values(activities).onConflictDoNothing();
  });
  console.log("M4 development data applied.");
}

seed().catch((error) => { console.error("M4 seed failed.", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => closeDb());
