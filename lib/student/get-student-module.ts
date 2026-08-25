import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { classrooms, enrollments, learningModules, profiles, students } from "../../db/schema";
import { requireStudent } from "./require-student";

export async function getStudentModule(moduleId: string) {
  const { student } = await requireStudent(`/student/modules/${moduleId}`);
  const result = (await getDb().select({ module: learningModules, classroom: classrooms, teacherName: profiles.displayName })
    .from(learningModules).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .innerJoin(profiles, eq(profiles.id, classrooms.teacherId))
    .innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(learningModules.id, moduleId), eq(learningModules.phase, "published"), eq(enrollments.studentId, student.id), eq(enrollments.status, "active"), eq(classrooms.status, "active"))).limit(1))[0];
  if (!result) notFound();
  return result;
}

export function parseMethodologies(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
