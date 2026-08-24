import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, evidences, evaluationScores, evaluations, rubrics } from "../../../db/schema";
import { recordAudit } from "../../audit";

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const evidenceId = new URL(request.url).searchParams.get("evidenceId");
  const db = getDb();
  const rows = await db.select({ evaluation: evaluations, score: evaluationScores }).from(evaluations).leftJoin(evaluationScores, eq(evaluationScores.evaluationId, evaluations.id)).innerJoin(evidences, eq(evidences.id, evaluations.evidenceId)).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(evidenceId ? and(eq(classrooms.teacherId, user.id), eq(evaluations.evidenceId, evidenceId)) : eq(classrooms.teacherId, user.id)).orderBy(desc(evaluations.createdAt));
  const grouped = new Map<string, { evaluation: (typeof rows)[number]["evaluation"]; scores: Array<(typeof evaluationScores)["$inferSelect"]> }>();
  for (const row of rows) { const current = grouped.get(row.evaluation.id) ?? { evaluation: row.evaluation, scores: [] }; if (row.score) current.scores.push(row.score); grouped.set(row.evaluation.id, current); }
  return Response.json({ evaluations: [...grouped.values()] });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { evidenceId?: string; rubricId?: string; score?: string; feedback?: string; scores?: Array<{ criterionId?: string; score?: string; feedback?: string }> };
  if (!body.evidenceId) return Response.json({ error: "La evidencia es obligatoria." }, { status: 400 });
  const db = getDb();
  const allowed = await db.select({ evidenceId: evidences.id }).from(evidences).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(and(eq(evidences.id, body.evidenceId), eq(classrooms.teacherId, user.id))).limit(1);
  if (!allowed.length) return Response.json({ error: "La evidencia no pertenece a un aula del docente actual." }, { status: 403 });
  if (body.rubricId) {
    const rubric = await db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.id, body.rubricId)).limit(1);
    if (!rubric.length) return Response.json({ error: "La rúbrica no existe." }, { status: 400 });
  }
  const evaluationId = crypto.randomUUID();
  await db.insert(evaluations).values({ id: evaluationId, evidenceId: body.evidenceId, rubricId: body.rubricId ?? null, teacherId: user.id, score: body.score?.trim() || null, feedback: body.feedback?.trim() || null, status: "published" });
  const scores = (body.scores ?? []).filter((item) => item.criterionId && item.score).map((item) => ({ id: crypto.randomUUID(), evaluationId, criterionId: item.criterionId!, score: item.score!.trim(), feedback: item.feedback?.trim() || null }));
  if (scores.length) await db.insert(evaluationScores).values(scores);
  await recordAudit({ actorId: user.id, action: "evaluation.created", entityType: "evaluation", entityId: evaluationId, metadata: { evidenceId: body.evidenceId, rubricId: body.rubricId ?? null } });
  return Response.json({ evaluation: { id: evaluationId, evidenceId: body.evidenceId, rubricId: body.rubricId ?? null, score: body.score ?? null, scores } }, { status: 201, headers: { "cache-control": "no-store" } });
}
