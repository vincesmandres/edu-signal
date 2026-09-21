import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { classrooms, evidences, enrollments, learningActivities, learningModules } from "../../../../db/schema";
import { validateEvidenceContent, validateEvidenceType } from "../../../../lib/evidence";
import { requireStudent } from "../../../../lib/student/require-student";
import { toEvidenceDto } from "../../../../lib/evidence-dto";
import { lockActiveEnrollment, logAuthorizationOperationError } from "../../../../lib/authorization";

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
    .innerJoin(enrollments, and(eq(enrollments.classroomId, evidences.classroomId), eq(enrollments.studentId, student.id), eq(enrollments.status, "active")))
    .where(eq(evidences.studentId, student.id)).orderBy(asc(evidences.createdAt));
  return Response.json({ evidences: rows.map((row) => ({ ...row, evidence: toEvidenceDto(row.evidence) })) });
}

export async function POST(request: Request) {
  const { student } = await requireStudent();
  let body: { activityId?: unknown; title?: unknown; description?: unknown; evidenceType?: unknown; textContent?: unknown; externalUrl?: unknown };
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "JSON inválido." }, { status: 400 }); body = parsed as typeof body; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (typeof body.activityId !== "string" || !title || !validateEvidenceType(body.evidenceType)) return Response.json({ error: "Actividad, título y tipo de evidencia son obligatorios." }, { status: 400 });
  let context;
  try { context = await activityContext(body.activityId, student.id); } catch { logAuthorizationOperationError("student_evidence_create_lookup"); return Response.json({ error: "No se pudo consultar la actividad." }, { status: 500 }); }
  if (!context) return Response.json({ error: "Actividad no disponible." }, { status: 404 });
  if (!context.activity.requiresEvidence) return Response.json({ error: "Esta actividad no requiere evidencia." }, { status: 400 });
  const contentError = validateEvidenceContent({ evidenceType: body.evidenceType, textContent: body.textContent, externalUrl: body.externalUrl });
  if (contentError && body.evidenceType !== "file") return Response.json({ error: contentError }, { status: 400 });
  const evidenceType = body.evidenceType;
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const textContent = typeof body.textContent === "string" ? body.textContent.trim() || null : null;
  const externalUrl = typeof body.externalUrl === "string" ? body.externalUrl.trim() || null : null;
  try {
    const db = getDb();
    const evidence = await db.transaction(async (tx) => {
      const enrollment = await lockActiveEnrollment(tx, student.id, context.classroom.id);
      if (!enrollment) throw new Error("inactive_enrollment");
      const currentContext = (await tx.select({ activity: learningActivities, module: learningModules, classroom: classrooms })
        .from(learningActivities).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
        .where(and(eq(learningActivities.id, body.activityId as string), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"), eq(classrooms.id, context.classroom.id))).for("update").limit(1))[0];
      if (!currentContext || !currentContext.activity.requiresEvidence) throw new Error("activity_unavailable");
      return (await tx.insert(evidences).values({ id: crypto.randomUUID(), studentId: student.id, classroomId: currentContext.classroom.id, moduleId: currentContext.module.id, activityId: currentContext.activity.id, title, description, evidenceType, textContent, externalUrl, status: "draft" }).returning())[0];
    });
    return Response.json({ evidence: toEvidenceDto(evidence) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "inactive_enrollment") return Response.json({ error: "El enrollment no está activo." }, { status: 422 });
    if (error instanceof Error && error.message === "activity_unavailable") return Response.json({ error: "Actividad no disponible." }, { status: 404 });
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") return Response.json({ error: "Ya existe evidencia para esta actividad." }, { status: 409 });
    logAuthorizationOperationError("student_evidence_create");
    return Response.json({ error: "No se pudo crear la evidencia." }, { status: 500 });
  }
}
