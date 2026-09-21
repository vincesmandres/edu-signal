import { and, eq } from "drizzle-orm";
import { getApiProfile } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { classrooms, evidences, evaluations, evaluationScores, learningActivities, learningModules, rubricCriteria, rubrics, students } from "../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const id = (await context.params).evidenceId;
  const db = getDb();
  const row = (await db.select({ evidence: evidences, student: students, classroom: classrooms, module: learningModules, activity: learningActivities })
    .from(evidences).innerJoin(students, eq(students.id, evidences.studentId)).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).leftJoin(learningModules, eq(learningModules.id, evidences.moduleId)).leftJoin(learningActivities, eq(learningActivities.id, evidences.activityId))
    .where(and(eq(evidences.id, id), eq(evidences.status, "submitted"), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!row) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  const evaluationRows = await db.select({ evaluation: evaluations, score: evaluationScores }).from(evaluations).leftJoin(evaluationScores, eq(evaluationScores.evaluationId, evaluations.id)).where(eq(evaluations.evidenceId, id)).orderBy(evaluations.createdAt);
  const evaluationsResult = new Map<string, { evaluation: typeof evaluations.$inferSelect; scores: typeof evaluationScores.$inferSelect[] }>();
  for (const item of evaluationRows) { const current = evaluationsResult.get(item.evaluation.id) ?? { evaluation: item.evaluation, scores: [] }; if (item.score) current.scores.push(item.score); evaluationsResult.set(item.evaluation.id, current); }
  const rubricRows = await db.select({ rubric: rubrics, criterion: rubricCriteria }).from(rubrics).leftJoin(rubricCriteria, eq(rubricCriteria.rubricId, rubrics.id)).where(eq(rubrics.classroomId, row.classroom.id)).orderBy(rubrics.createdAt, rubricCriteria.position);
  const rubricMap = new Map<string, { rubric: typeof rubrics.$inferSelect; criteria: typeof rubricCriteria.$inferSelect[] }>();
  for (const item of rubricRows) { const current = rubricMap.get(item.rubric.id) ?? { rubric: item.rubric, criteria: [] }; if (item.criterion) current.criteria.push(item.criterion); rubricMap.set(item.rubric.id, current); }
  return Response.json({ evidence: { ...row.evidence, storageKey: undefined, studentName: row.student.displayName, classroomName: row.classroom.name, moduleTitle: row.module?.title ?? null, activityTitle: row.activity?.title ?? null }, evaluations: [...evaluationsResult.values()], rubrics: [...rubricMap.values()] }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH() { return Response.json({ error: "La evidencia enviada es inmutable." }, { status: 409 }); }
export async function POST() { return Response.json({ error: "La evidencia enviada es inmutable." }, { status: 409 }); }
