import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { activityResponses, classrooms, enrollments, learningActivities, learningModules, studentActivityProgress, students } from "../../../../../../db/schema";
import { requiresResponse } from "../../../../../../lib/activities";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { recordAudit } from "../../../../../../app/audit";

export async function POST(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  const activity = (await getDb().select({ activity: learningActivities }).from(learningActivities)
    .innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id)).innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(learningActivities.id, activityId), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"), eq(enrollments.status, "active"), eq(students.id, student.id))).limit(1))[0]?.activity;
  if (!activity) return Response.json({ error: "Actividad no encontrada." }, { status: 404 });
  if (requiresResponse(activity.activityType)) {
    const response = (await getDb().select({ id: activityResponses.id }).from(activityResponses).where(and(eq(activityResponses.activityId, activityId), eq(activityResponses.studentId, student.id))).limit(1))[0];
    if (!response) return Response.json({ error: "Guarda una respuesta antes de completar esta actividad." }, { status: 400 });
  }
  const progress = (await getDb().insert(studentActivityProgress).values({ id: crypto.randomUUID(), studentId: student.id, activityId, status: "completed", startedAt: new Date().toISOString(), completedAt: new Date().toISOString() }).onConflictDoUpdate({ target: [studentActivityProgress.studentId, studentActivityProgress.activityId], set: { status: "completed", completedAt: new Date().toISOString() } }).returning())[0];
  await recordAudit({ actorId: student.profileId ?? student.id, action: "activity.completed", entityType: "activity_progress", entityId: progress.id, metadata: { activityId } });
  return Response.json({ progress });
}
