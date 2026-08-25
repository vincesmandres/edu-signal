import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { activityResponses, classrooms, enrollments, learningActivities, learningModules, students } from "../../../../../../db/schema";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { recordAudit } from "../../../../../../app/audit";

export async function POST(request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  const activity = await accessibleActivity(activityId, student.id);
  if (!activity) return Response.json({ error: "Actividad no encontrada." }, { status: 404 });
  const body = await request.json() as { response?: string };
  const response = body.response?.trim();
  if (!response) return Response.json({ error: "La respuesta no puede estar vacía." }, { status: 400 });
  const saved = (await getDb().insert(activityResponses).values({ id: crypto.randomUUID(), studentId: student.id, activityId, response, status: "draft" }).onConflictDoUpdate({ target: [activityResponses.studentId, activityResponses.activityId], set: { response, updatedAt: new Date().toISOString() } }).returning())[0];
  await recordAudit({ actorId: student.profileId ?? student.id, action: "activity.response_saved", entityType: "activity_response", entityId: saved.id, metadata: { activityId } });
  return Response.json({ response: saved });
}

async function accessibleActivity(activityId: string, studentId: string) {
  const rows = await getDb().select({ activity: learningActivities }).from(learningActivities)
    .innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id)).innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(learningActivities.id, activityId), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"), eq(enrollments.status, "active"), eq(students.id, studentId))).limit(1);
  return rows[0]?.activity ?? null;
}
