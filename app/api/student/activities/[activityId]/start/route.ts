import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { classrooms, enrollments, learningActivities, learningModules, studentActivityProgress, students } from "../../../../../../db/schema";
import { requireStudent } from "../../../../../../lib/student/require-student";

export async function POST(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  const activities = await getStudentActivitiesForActivity(activityId, student.id);
  if (!activities) return Response.json({ error: "Actividad no encontrada." }, { status: 404 });
  const existing = (await getDb().select().from(studentActivityProgress).where(and(eq(studentActivityProgress.studentId, student.id), eq(studentActivityProgress.activityId, activityId))).limit(1))[0];
  if (existing) return Response.json({ progress: existing });
  const progress = (await getDb().insert(studentActivityProgress).values({ id: crypto.randomUUID(), studentId: student.id, activityId, status: "in_progress", startedAt: new Date().toISOString() }).returning())[0];
  return Response.json({ progress }, { status: 201 });
}

async function getStudentActivitiesForActivity(activityId: string, studentId: string) {
  const rows = await getDb().select({ activity: learningActivities }).from(learningActivities)
    .innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId))
    .innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(learningActivities.id, activityId), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"), eq(enrollments.status, "active"), eq(students.id, studentId))).limit(1);
  return rows[0] ?? null;
}
