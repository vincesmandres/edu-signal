import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { auditEvents, classrooms, evidences, evaluationScores, evaluations, rubricCriteria, rubrics } from "../../../db/schema";
import { validateEvaluationScores, validateGlobalScore } from "../../../lib/evaluation-validation";

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const evidenceId = new URL(request.url).searchParams.get("evidenceId");
  const rows = await getDb().select({ evaluation: evaluations, score: evaluationScores }).from(evaluations).leftJoin(evaluationScores, eq(evaluationScores.evaluationId, evaluations.id)).innerJoin(evidences, eq(evidences.id, evaluations.evidenceId)).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(evidenceId ? and(eq(classrooms.teacherId, auth.profile.id), eq(evaluations.evidenceId, evidenceId), eq(evidences.status, "submitted")) : and(eq(classrooms.teacherId, auth.profile.id), eq(evidences.status, "submitted"))).orderBy(desc(evaluations.createdAt));
  const grouped = new Map<string, { evaluation: typeof evaluations.$inferSelect; scores: Array<typeof evaluationScores.$inferSelect> }>();
  for (const row of rows) { const current = grouped.get(row.evaluation.id) ?? { evaluation: row.evaluation, scores: [] }; if (row.score) current.scores.push(row.score); grouped.set(row.evaluation.id, current); }
  return Response.json({ evaluations: [...grouped.values()] });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  let body: { evidenceId?: unknown; rubricId?: unknown; score?: unknown; feedback?: unknown; scores?: Array<{ criterionId?: unknown; score?: unknown; feedback?: unknown }> };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "El cuerpo JSON debe ser un objeto." }, { status: 400 });
    body = parsed as typeof body;
  } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (typeof body.evidenceId !== "string" || !body.evidenceId) return Response.json({ error: "La evidencia es obligatoria." }, { status: 400 });
  const db = getDb();
  const evidence = (await db.select({ evidence: evidences, classroom: classrooms }).from(evidences).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(and(eq(evidences.id, body.evidenceId), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.evidence.status !== "submitted") return Response.json({ error: "Sólo se puede evaluar evidencia enviada." }, { status: 422 });
  const duplicate = await db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.evidenceId, body.evidenceId), eq(evaluations.teacherId, auth.profile.id))).limit(1);
  if (duplicate.length) return Response.json({ error: "La evidencia ya tiene una evaluación." }, { status: 409 });
  const rubricId = typeof body.rubricId === "string" && body.rubricId ? body.rubricId : null;
  if (body.scores !== undefined && !Array.isArray(body.scores)) return Response.json({ error: "Los criterios deben ser una lista." }, { status: 400 });
  const scores = body.scores ?? [];
  const globalError = validateGlobalScore(body.score);
  if (globalError) return Response.json({ error: globalError }, { status: 422 });
  let criteria: Array<typeof rubricCriteria.$inferSelect> = [];
  if (rubricId) {
    const rubric = (await db.select({ rubric: rubrics }).from(rubrics).where(and(eq(rubrics.id, rubricId), eq(rubrics.classroomId, evidence.classroom.id))).limit(1))[0];
    if (!rubric) return Response.json({ error: "La rúbrica no pertenece al aula de la evidencia." }, { status: 403 });
    criteria = await db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId));
    if (!criteria.length) return Response.json({ error: "La rúbrica seleccionada no tiene criterios evaluables." }, { status: 422 });
    const scoreError = validateEvaluationScores(scores, criteria);
    if (scoreError) return Response.json({ error: scoreError }, { status: 422 });
  } else if (scores.length) return Response.json({ error: "Los criterios requieren una rúbrica." }, { status: 422 });
  else if (body.score === undefined || body.score === null || body.score === "") return Response.json({ error: "La evaluación global requiere una puntuación." }, { status: 422 });
  const evaluationId = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(evaluations).values({ id: evaluationId, evidenceId: body.evidenceId as string, rubricId, teacherId: auth.profile!.id, score: body.score == null || body.score === "" ? null : String(body.score), feedback: typeof body.feedback === "string" ? body.feedback.trim() || null : null, status: "published" });
      if (rubricId && scores.length) await tx.insert(evaluationScores).values(scores.map((item) => ({ id: crypto.randomUUID(), evaluationId, criterionId: item.criterionId as string, score: String(item.score), feedback: typeof item.feedback === "string" ? item.feedback.trim() || null : null })));
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: auth.profile!.id, action: "evaluation.created", entityType: "evaluation", entityId: evaluationId, metadata: JSON.stringify({ evidenceId: body.evidenceId, rubricId }) });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") return Response.json({ error: "La evidencia ya tiene una evaluación." }, { status: 409 });
    return Response.json({ error: "No se pudo guardar la evaluación." }, { status: 500 });
  }
  return Response.json({ evaluation: { id: evaluationId, evidenceId: body.evidenceId, rubricId, score: body.score ?? null, feedback: body.feedback ?? null } }, { status: 201, headers: { "cache-control": "no-store" } });
}
