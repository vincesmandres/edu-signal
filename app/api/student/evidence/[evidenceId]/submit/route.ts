import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { evidences } from "../../../../../../db/schema";
import { validateEvidenceContent } from "../../../../../../lib/evidence";
import { requireStudent } from "../../../../../../lib/student/require-student";

export async function POST(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  const evidence = (await getDb().select().from(evidences).where(and(eq(evidences.id, id), eq(evidences.studentId, student.id))).limit(1))[0];
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia ya fue enviada." }, { status: 409 });
  const error = validateEvidenceContent(evidence); if (error) return Response.json({ error }, { status: 400 });
  const updated = (await getDb().update(evidences).set({ status: "submitted", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(evidences.id, id), eq(evidences.status, "draft"))).returning())[0];
  return Response.json({ evidence: updated });
}
