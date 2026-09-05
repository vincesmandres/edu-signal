import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { classrooms, evidences, enrollments, learningActivities, learningModules } from "../../../../db/schema";
import { validateEvidenceContent, validateEvidenceType } from "../../../../lib/evidence";
import { requireStudent } from "../../../../lib/student/require-student";

async function activityContext(activityId: string, studentId: string) {
  return (await getDb().select({ activity: learningActivities, module: learningModules, classroom: classrooms })
    .from(learningActivities).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId))
    .innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
    .where(and(eq(learningActivities.id, activityId), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"), eq(enrollments.studentId, studentId), eq(enrollments.status, "active"))).limit(1))[0];
}

export async function GET() {
  const { student } = await requireStudent("/student/evidence");
  const rows = await getDb().select({ evidence: evidences, module: learningModules, activity: learningActivities, classroom: classrooms })
    .from(evidences).leftJoin(learningModules, eq(learningModules.id, evidences.moduleId)).leftJoin(learningActivities, eq(learningActivities.id, evidences.activityId)).leftJoin(classrooms, eq(classrooms.id, evidences.classroomId))
    .where(eq(evidences.studentId, student.id)).orderBy(asc(evidences.createdAt));
  return Response.json({ evidences: rows });
}

export async function POST(request: Request) {
  const { student } = await requireStudent();
  const body = await request.json() as { activityId?: string; title?: string; description?: string; evidenceType?: string; textContent?: string; externalUrl?: string };
  const title = body.title?.trim();
  if (!title || !body.activityId || !validateEvidenceType(body.evidenceType)) return Response.json({ error: "Actividad, título y tipo de evidencia son obligatorios." }, { status: 400 });
  const context = await activityContext(body.activityId, student.id);
  if (!context) return Response.json({ error: "Actividad no disponible." }, { status: 404 });
  if (!context.activity.requiresEvidence) return Response.json({ error: "Esta actividad no requiere evidencia." }, { status: 400 });
  const contentError = validateEvidenceContent({ evidenceType: body.evidenceType, textContent: body.textContent, externalUrl: body.externalUrl });
  if (contentError && body.evidenceType !== "file") return Response.json({ error: contentError }, { status: 400 });
  const evidence = (await getDb().insert(evidences).values({ id: crypto.randomUUID(), studentId: student.id, classroomId: context.classroom.id, moduleId: context.module.id, activityId: context.activity.id, title, description: body.description?.trim() || null, evidenceType: body.evidenceType, textContent: body.textContent?.trim() || null, externalUrl: body.externalUrl?.trim() || null, status: "draft" }).returning())[0];
  return Response.json({ evidence }, { status: 201 });
}
