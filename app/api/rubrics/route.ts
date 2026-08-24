import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, rubricCriteria, rubrics } from "../../../db/schema";
import { recordAudit } from "../../audit";

function id() { return crypto.randomUUID(); }

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const classroomId = new URL(request.url).searchParams.get("classroomId");
  const db = getDb();
  const rows = await db.select({ rubric: rubrics, criteria: rubricCriteria }).from(rubrics).leftJoin(rubricCriteria, eq(rubricCriteria.rubricId, rubrics.id)).innerJoin(classrooms, eq(classrooms.id, rubrics.classroomId)).where(classroomId ? and(eq(classrooms.teacherId, user.id), eq(rubrics.classroomId, classroomId)) : eq(classrooms.teacherId, user.id)).orderBy(desc(rubrics.createdAt));
  const grouped = new Map<string, { rubric: typeof rows[number]["rubric"]; criteria: typeof rubricCriteria.$inferSelect[] }>();
  for (const row of rows) {
    const current = grouped.get(row.rubric.id) ?? { rubric: row.rubric, criteria: [] };
    if (row.criteria) current.criteria.push(row.criteria);
    grouped.set(row.rubric.id, current);
  }
  return Response.json({ rubrics: [...grouped.values()] });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { title?: string; description?: string; classroomId?: string; criteria?: Array<{ name?: string; description?: string; maxScore?: string }> };
  const title = body.title?.trim();
  if (!title || !body.classroomId) return Response.json({ error: "Título y aula son obligatorios." }, { status: 400 });
  const db = getDb();
  const classroom = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, body.classroomId), eq(classrooms.teacherId, user.id))).limit(1);
  if (!classroom.length) return Response.json({ error: "El aula no pertenece al docente actual." }, { status: 403 });
  const rubricId = id();
  await db.insert(rubrics).values({ id: rubricId, classroomId: body.classroomId, title, description: body.description?.trim() || null });
  const criteria = (body.criteria ?? []).filter((criterion) => criterion.name?.trim() && criterion.description?.trim()).map((criterion, position) => ({ id: id(), rubricId, name: criterion.name!.trim(), description: criterion.description!.trim(), maxScore: criterion.maxScore?.trim() || "4", position: String(position) }));
  if (criteria.length) await db.insert(rubricCriteria).values(criteria);
  await recordAudit({ actorId: user.id, action: "rubric.created", entityType: "rubric", entityId: rubricId, metadata: { classroomId: body.classroomId, criteriaCount: criteria.length } });
  return Response.json({ rubric: { id: rubricId, title, classroomId: body.classroomId, criteria } }, { status: 201 });
}
