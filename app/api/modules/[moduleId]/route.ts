import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { classrooms, learningModules } from "../../../../db/schema";
import { getApiProfile } from "../../../../lib/auth";
import { recordAudit } from "@/app/audit";

const phases = ["draft", "published", "archived"] as const;

async function ownedModule(moduleId: string, teacherId: string) {
  return (await getDb().select({ module: learningModules, classroom: classrooms }).from(learningModules)
    .innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .where(and(eq(learningModules.id, moduleId), eq(classrooms.teacherId, teacherId))).limit(1))[0];
}

export async function GET(_request: Request, context: { params: Promise<{ moduleId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { moduleId } = await context.params;
  const result = await ownedModule(moduleId, auth.profile.id);
  if (!result) return Response.json({ error: "Módulo no encontrado." }, { status: 404 });
  return Response.json(result);
}

export async function PATCH(request: Request, context: { params: Promise<{ moduleId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { moduleId } = await context.params;
  const result = await ownedModule(moduleId, auth.profile.id);
  if (!result) return Response.json({ error: "Módulo no encontrado." }, { status: 404 });
  const body = await request.json() as { title?: string; drivingQuestion?: string; methodologies?: string[]; phase?: string };
  const phase = body.phase ?? result.module.phase;
  if (!phases.includes(phase as (typeof phases)[number])) return Response.json({ error: "Estado de módulo no válido." }, { status: 400 });
  const title = body.title?.trim() ?? result.module.title;
  const drivingQuestion = body.drivingQuestion?.trim() ?? result.module.drivingQuestion;
  if (!title || !drivingQuestion) return Response.json({ error: "Título y pregunta guía son obligatorios." }, { status: 400 });
  const updated = (await getDb().update(learningModules).set({ title, drivingQuestion, methodologies: body.methodologies ? JSON.stringify(body.methodologies) : result.module.methodologies, phase }).where(eq(learningModules.id, moduleId)).returning())[0];
  await recordAudit({ actorId: auth.profile.id, action: `module.${phase === "published" ? "published" : phase === "archived" ? "archived" : "updated"}`, entityType: "module", entityId: moduleId });
  return Response.json({ module: updated });
}
