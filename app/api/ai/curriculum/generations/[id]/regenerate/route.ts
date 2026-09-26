import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { curriculumGenerations, teacherMaterials } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { curriculumDraftSchema, generationInputSchema } from "@/lib/ai/contracts";
import { generateCurriculum, mergeRegeneratedSection } from "@/lib/ai/curriculum";
import { AiProviderError } from "@/lib/ai/provider";
import { AiQuotaError, assertAiQuota, recordAiUsage } from "@/lib/ai/usage";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { id } = await context.params;
  const generation = (await getDb().select().from(curriculumGenerations).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.teacherId, auth.profile.id))).limit(1))[0];
  if (!generation) return Response.json({ error: "Generation not found." }, { status: 404 });
  if (generation.status !== "completed") return Response.json({ error: "Only completed drafts can be regenerated." }, { status: 409 });
  let body: { section?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body.section !== "string" || (generation.lockedSections as unknown[]).includes(body.section)) return Response.json({ error: "Section is invalid or locked." }, { status: 409 });
  const input = generationInputSchema.safeParse(generation.sanitizedInput);
  const draft = curriculumDraftSchema.safeParse(generation.draft);
  if (!input.success || !draft.success) return Response.json({ error: "Stored generation is invalid." }, { status: 422 });
  const materials = input.data.materialReferences.length ? await getDb().select({ extractedText: teacherMaterials.extractedText, extractionStatus: teacherMaterials.extractionStatus }).from(teacherMaterials).where(and(inArray(teacherMaterials.id, input.data.materialReferences), eq(teacherMaterials.teacherId, auth.profile.id))) : [];
  if (materials.some((item) => item.extractionStatus !== "completed" || !item.extractedText) || materials.length !== input.data.materialReferences.length) return Response.json({ error: "Referenced materials are no longer available." }, { status: 422 });
  try { await assertAiQuota(auth.profile.id, "curriculum", "teacher"); } catch (error) {
    if (error instanceof AiQuotaError) return Response.json({ error: "AI usage limit reached.", retryAt: error.retryAt }, { status: 429 });
    throw error;
  }
  try {
    const result = await generateCurriculum(input.data, { currentDraft: draft.data, section: body.section, materialText: materials.map((item) => item.extractedText!) });
    const merged = mergeRegeneratedSection(draft.data, result.data, body.section);
    const updated = (await getDb().update(curriculumGenerations).set({ draft: merged, model: result.model, promptVersion: result.promptVersion, usage: result.usage, updatedAt: new Date().toISOString() }).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.status, "completed"))).returning())[0];
    if (!updated) return Response.json({ error: "Generation changed concurrently." }, { status: 409 });
    await recordAiUsage(auth.profile.id, "curriculum", result.usage);
    return Response.json({ generation: updated }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : "invalid_output";
    return Response.json({ error: "Section regeneration failed.", errorCode: code }, { status: code === "rate_limited" ? 429 : 502 });
  }
}
