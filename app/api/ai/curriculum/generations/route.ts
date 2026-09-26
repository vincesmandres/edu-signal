import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { curriculumGenerations, teacherMaterials } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { generationInputSchema } from "@/lib/ai/contracts";
import { generateCurriculum, sanitizeGenerationInput } from "@/lib/ai/curriculum";
import { AiProviderError } from "@/lib/ai/provider";
import { AiQuotaError, assertAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { recordAudit } from "@/app/audit";

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  if (process.env.AI_CURRICULUM_ENABLED !== "true") return Response.json({ error: "AI curriculum generation is disabled." }, { status: 503 });
  let json: unknown;
  try { json = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = generationInputSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid generation input.", issues: parsed.error.flatten() }, { status: 422 });
  try { await assertAiQuota(auth.profile.id, "curriculum", "teacher"); } catch (error) {
    if (error instanceof AiQuotaError) return Response.json({ error: "AI usage limit reached.", retryAt: error.retryAt }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((Date.parse(error.retryAt) - Date.now()) / 1000))) } });
    throw error;
  }
  let materialText: string[] = [];
  if (parsed.data.materialReferences.length) {
    const owned = await getDb().select({ id: teacherMaterials.id, extractedText: teacherMaterials.extractedText, extractionStatus: teacherMaterials.extractionStatus }).from(teacherMaterials).where(and(inArray(teacherMaterials.id, parsed.data.materialReferences), eq(teacherMaterials.teacherId, auth.profile.id)));
    if (owned.length !== parsed.data.materialReferences.length) return Response.json({ error: "One or more material references are invalid." }, { status: 403 });
    if (owned.some((item) => item.extractionStatus !== "completed" || !item.extractedText)) return Response.json({ error: "Referenced materials must finish safe text extraction first." }, { status: 422 });
    materialText = owned.map((item) => item.extractedText!);
  }
  const id = crypto.randomUUID();
  const input = sanitizeGenerationInput(parsed.data);
  await getDb().insert(curriculumGenerations).values({ id, teacherId: auth.profile.id, sanitizedInput: input, status: "pending" });
  try {
    const result = await generateCurriculum(input, { materialText });
    await getDb().update(curriculumGenerations).set({ status: "completed", draft: result.data, model: result.model, promptVersion: result.promptVersion, usage: result.usage, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(curriculumGenerations.id, id));
    await recordAiUsage(auth.profile.id, "curriculum", result.usage);
    await recordAudit({ actorId: auth.profile.id, action: "curriculum_generation.completed", entityType: "curriculum_generation", entityId: id, metadata: { model: result.model, promptVersion: result.promptVersion } });
    return Response.json({ generation: { id, status: "completed", draft: result.data, lockedSections: [] } }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : error instanceof Error && error.message === "invalid_duration" ? "invalid_output" : "provider";
    await getDb().update(curriculumGenerations).set({ status: "failed", errorCode: code, updatedAt: new Date().toISOString() }).where(eq(curriculumGenerations.id, id));
    return Response.json({ generation: { id, status: "failed", errorCode: code } }, { status: code === "rate_limited" ? 429 : 502, headers: { "cache-control": "no-store" } });
  }
}
