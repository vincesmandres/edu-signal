import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { classrooms, enrollments, learningModules, profiles, students } from "../../db/schema";
import { requireStudent } from "./require-student";

export async function getStudentClassroom(classroomId: string) {
  const { student } = await requireStudent(`/student/classrooms/${classroomId}`);
  const classroom = (await getDb().select({ classroom: classrooms, teacherName: profiles.displayName })
    .from(enrollments).innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId))
    .innerJoin(profiles, eq(profiles.id, classrooms.teacherId))
    .where(and(eq(enrollments.classroomId, classroomId), eq(enrollments.studentId, student.id), eq(enrollments.status, "active"), eq(classrooms.status, "active"))).limit(1))[0];
  if (!classroom) notFound();
  const modules = await getDb().select().from(learningModules)
    .where(and(eq(learningModules.classroomId, classroomId), eq(learningModules.phase, "published")))
    .orderBy(asc(learningModules.createdAt));
  return { student, classroom: classroom.classroom, teacherName: classroom.teacherName, modules };
}
