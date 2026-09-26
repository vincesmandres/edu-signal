import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, classrooms } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { gradeScaleSchema } from "@/lib/ai/contracts";

export async function PATCH(request: Request, context: { params: Promise<{ classroomId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { classroomId } = await context.params; let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = gradeScaleSchema.safeParse(body); if (!parsed.success) return Response.json({ error: "Invalid grade scale." }, { status: 422 });
  const updated = await getDb().transaction(async (tx) => {
    const current = (await tx.select().from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, auth.profile!.id))).for("update").limit(1))[0];
    if (!current) return null;
    const row = (await tx.update(classrooms).set({ gradeScaleType: parsed.data.type, gradeScaleMin: String(parsed.data.min), gradeScaleMax: String(parsed.data.max), gradePassThreshold: String(parsed.data.passThreshold), updatedAt: new Date().toISOString() }).where(eq(classrooms.id, classroomId)).returning())[0];
    await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: auth.profile!.id, action: "classroom.grade_scale_updated", entityType: "classroom", entityId: classroomId, metadata: JSON.stringify(parsed.data) });
    return row;
  });
  if (!updated) return Response.json({ error: "Classroom not found." }, { status: 404 });
  return Response.json({ classroom: updated });
}
