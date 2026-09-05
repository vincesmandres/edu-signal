import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { activityResponses, classrooms, enrollments, evidences, learningActivities, learningModules, profiles, studentActivityProgress, students } from "../../db/schema";
import { requireStudent } from "./require-student";

export async function getStudentActivities(moduleId: string) {
  const { student } = await requireStudent(`/student/modules/${moduleId}`);
  const moduleContext = (await getDb().select({ module: learningModules, classroom: classrooms, teacherName: profiles.displayName })
    .from(learningModules).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).innerJoin(profiles, eq(profiles.id, classrooms.teacherId))
    .innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id)).innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(learningModules.id, moduleId), eq(learningModules.phase, "published"), eq(enrollments.studentId, student.id), eq(enrollments.status, "active"))).limit(1))[0];
  if (!moduleContext) notFound();
  const activities = await getDb().select({ activity: learningActivities, progress: studentActivityProgress, response: activityResponses, evidence: evidences })
    .from(learningActivities).leftJoin(studentActivityProgress, and(eq(studentActivityProgress.activityId, learningActivities.id), eq(studentActivityProgress.studentId, student.id)))
    .leftJoin(activityResponses, and(eq(activityResponses.activityId, learningActivities.id), eq(activityResponses.studentId, student.id)))
    .leftJoin(evidences, and(eq(evidences.activityId, learningActivities.id), eq(evidences.studentId, student.id)))
    .where(and(eq(learningActivities.moduleId, moduleId), eq(learningActivities.status, "published"))).orderBy(asc(learningActivities.position), asc(learningActivities.createdAt));
  return { ...moduleContext, student, activities };
}
