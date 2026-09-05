import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, learningActivities, learningModules } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { validateActivityConfig } from "@/lib/activities";
import { recordAudit } from "@/app/audit";

export async function PATCH(request: Request, context: { params: Promise<{ activityId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { activityId } = await context.params;
  const current = (await getDb().select({ activity: learningActivities }).from(learningActivities).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).where(and(eq(learningActivities.id, activityId), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!current) return Response.json({ error: "Actividad no encontrada." }, { status: 404 });
  const body = await request.json() as { title?: string; instructions?: string; activityType?: string; position?: number; required?: boolean; requiresEvidence?: boolean; config?: unknown; status?: string };
  const type = body.activityType ?? current.activity.activityType;
  const config = body.config ?? current.activity.config;
  const validation = validateActivityConfig(type, config);
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
  const status = body.status ?? current.activity.status;
  if (!["draft", "published", "archived"].includes(status)) return Response.json({ error: "Estado de actividad no válido." }, { status: 400 });
  const updated = (await getDb().update(learningActivities).set({ title: body.title?.trim() ?? current.activity.title, instructions: body.instructions?.trim() ?? current.activity.instructions, activityType: type, position: Number.isInteger(body.position) ? body.position : current.activity.position, required: body.required ?? current.activity.required, requiresEvidence: body.requiresEvidence ?? current.activity.requiresEvidence, config: validation.config, status, publishedAt: status === "published" ? current.activity.publishedAt ?? new Date().toISOString() : null }).where(eq(learningActivities.id, activityId)).returning())[0];
  await recordAudit({ actorId: auth.profile.id, action: `activity.${status === "published" ? "published" : status === "archived" ? "archived" : "updated"}`, entityType: "activity", entityId: activityId });
  return Response.json({ activity: updated });
}
