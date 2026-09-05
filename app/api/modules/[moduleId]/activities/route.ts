import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { classrooms, learningActivities, learningModules } from "../../../../../db/schema";
import { getApiProfile } from "../../../../../lib/auth";
import { validateActivityConfig } from "../../../../../lib/activities";
import { recordAudit } from "../../../../audit";

async function ownedModule(moduleId: string, teacherId: string) {
  return (await getDb().select({ module: learningModules, classroom: classrooms }).from(learningModules).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).where(and(eq(learningModules.id, moduleId), eq(classrooms.teacherId, teacherId))).limit(1))[0];
}

export async function GET(_request: Request, context: { params: Promise<{ moduleId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { moduleId } = await context.params;
  if (!await ownedModule(moduleId, auth.profile.id)) return Response.json({ error: "Módulo no encontrado." }, { status: 404 });
  const activities = await getDb().select().from(learningActivities).where(eq(learningActivities.moduleId, moduleId)).orderBy(asc(learningActivities.position), asc(learningActivities.createdAt));
  return Response.json({ activities });
}

export async function POST(request: Request, context: { params: Promise<{ moduleId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { moduleId } = await context.params;
  if (!await ownedModule(moduleId, auth.profile.id)) return Response.json({ error: "Módulo no encontrado." }, { status: 404 });
  const body = await request.json() as { title?: string; instructions?: string; activityType?: string; position?: number; required?: boolean; requiresEvidence?: boolean; config?: unknown };
  const title = body.title?.trim();
  if (!title || !body.activityType) return Response.json({ error: "Título y tipo son obligatorios." }, { status: 400 });
  const validation = validateActivityConfig(body.activityType, body.config ?? {});
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
  const activity = (await getDb().insert(learningActivities).values({ id: crypto.randomUUID(), moduleId, title, instructions: body.instructions?.trim() ?? "", activityType: body.activityType, position: Number.isInteger(body.position) ? body.position : 1, required: body.required !== false, requiresEvidence: body.requiresEvidence === true, config: validation.config }).returning())[0];
  await recordAudit({ actorId: auth.profile.id, action: "activity.created", entityType: "activity", entityId: activity.id, metadata: { moduleId, activityType: activity.activityType } });
  return Response.json({ activity }, { status: 201 });
}
