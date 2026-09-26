import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { curriculumGenerations } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { curriculumDraftSchema } from "@/lib/ai/contracts";

async function ownedGeneration(teacherId: string, id: string) {
  return (await getDb().select().from(curriculumGenerations).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.teacherId, teacherId))).limit(1))[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { id } = await context.params;
  const generation = await ownedGeneration(auth.profile.id, id);
  if (!generation) return Response.json({ error: "Generation not found." }, { status: 404 });
  return Response.json({ generation }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { id } = await context.params;
  const generation = await ownedGeneration(auth.profile.id, id);
  if (!generation) return Response.json({ error: "Generation not found." }, { status: 404 });
  if (generation.status !== "completed") return Response.json({ error: "Only completed drafts can be edited." }, { status: 409 });
  let body: { draft?: unknown; lockedSections?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const draft = curriculumDraftSchema.safeParse(body.draft);
  const allowed = new Set(["classroom", "module", "activities", "rubric", "resources", "differentiation", "accessibility", "warnings", "assumptions"]);
  if (!draft.success || !Array.isArray(body.lockedSections) || body.lockedSections.some((item) => typeof item !== "string" || !allowed.has(item))) return Response.json({ error: "Invalid curriculum draft or locked sections." }, { status: 422 });
  const lockedSections = [...new Set(body.lockedSections as string[])];
  const updated = (await getDb().update(curriculumGenerations).set({ draft: draft.data, lockedSections, updatedAt: new Date().toISOString() }).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.teacherId, auth.profile.id), eq(curriculumGenerations.status, "completed"))).returning())[0];
  if (!updated) return Response.json({ error: "Generation changed concurrently." }, { status: 409 });
  return Response.json({ generation: updated }, { headers: { "cache-control": "no-store" } });
}
