import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, rubricCriteria, rubrics } from "../../../db/schema";
import { auditEvents } from "../../../db/schema";
import { requireTeacherClassroom } from "../../../lib/authorization";

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
  let body: { title?: unknown; description?: unknown; classroomId?: unknown; criteria?: unknown };
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "JSON inválido." }, { status: 400 }); body = parsed as typeof body; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (typeof body.title !== "string" || typeof body.classroomId !== "string" || !title || !body.classroomId.trim()) return Response.json({ error: "Título y aula son obligatorios." }, { status: 400 });
  const classroomId = body.classroomId;
  if (!Array.isArray(body.criteria) || body.criteria.length === 0) return Response.json({ error: "La rúbrica requiere criterios." }, { status: 422 });
  const rawCriteria = body.criteria as Array<{ name?: unknown; description?: unknown; maxScore?: unknown }>;
  const normalizedNames = new Set<string>();
  const parsedCriteria: Array<{ name: string; description: string; maxScore: string }> = [];
  for (const criterion of rawCriteria) {
    if (!criterion || typeof criterion.name !== "string" || typeof criterion.description !== "string" || typeof criterion.maxScore !== "string") return Response.json({ error: "Criterio inválido." }, { status: 400 });
    const name = criterion.name.trim(); const description = criterion.description.trim(); const maxScore = criterion.maxScore.trim(); const max = Number(maxScore);
    if (!name || !description || !/^\d+(?:\.\d+)?$/.test(maxScore) || !Number.isFinite(max) || max <= 0 || max > 100) return Response.json({ error: "Cada criterio requiere descripción y maxScore válido." }, { status: 422 });
    const key = name.toLocaleLowerCase(); if (normalizedNames.has(key)) return Response.json({ error: "No se permiten criterios duplicados." }, { status: 422 });
    normalizedNames.add(key); parsedCriteria.push({ name, description, maxScore });
  }
  const db = getDb();
  if (!(await requireTeacherClassroom(user.id, body.classroomId))) return Response.json({ error: "El aula no pertenece al docente actual." }, { status: 403 });
  const rubricId = id();
  const criteria = parsedCriteria.map((criterion, position) => ({ id: id(), rubricId, ...criterion, position: String(position) }));
  try {
    await db.transaction(async (tx) => {
      await tx.insert(rubrics).values({ id: rubricId, classroomId, title, description: typeof body.description === "string" ? body.description.trim() || null : null });
      await tx.insert(rubricCriteria).values(criteria);
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: user.id, action: "rubric.created", entityType: "rubric", entityId: rubricId, metadata: JSON.stringify({ classroomId: body.classroomId, criteriaCount: criteria.length }) });
    });
  } catch { return Response.json({ error: "No se pudo crear la rúbrica." }, { status: 500 }); }
  return Response.json({ rubric: { id: rubricId, title, classroomId: body.classroomId, criteria } }, { status: 201 });
}
