import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { evidences } from "../../../../../db/schema";
import { validateEvidenceContent } from "../../../../../lib/evidence";
import { requireStudent } from "../../../../../lib/student/require-student";
import { deleteEvidenceFile } from "../../../../../lib/storage/evidence-storage";

async function ownEvidence(id: string, studentId: string) {
  return (await getDb().select().from(evidences).where(and(eq(evidences.id, id), eq(evidences.studentId, studentId))).limit(1))[0];
}
export async function GET(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const evidence = await ownEvidence((await context.params).evidenceId, student.id);
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 }); return Response.json({ evidence });
}
export async function PATCH(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const evidence = await ownEvidence((await context.params).evidenceId, student.id);
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia enviada es inmutable." }, { status: 409 });
  const body = await request.json() as { title?: string; description?: string; evidenceType?: string; textContent?: string; externalUrl?: string };
  const evidenceType = body.evidenceType ?? evidence.evidenceType;
  const values = { title: body.title?.trim() || evidence.title, description: body.description?.trim() || null, evidenceType, textContent: evidenceType === "text" ? body.textContent?.trim() || null : null, externalUrl: evidenceType === "link" ? body.externalUrl?.trim() || null : null };
  const error = validateEvidenceContent({ ...values, storageKey: evidenceType === "file" ? evidence.storageKey : null });
  if (error) return Response.json({ error }, { status: 400 });
  const updated = (await getDb().update(evidences).set({ ...values, ...(evidenceType === "file" ? {} : { storageKey: null, fileName: null, mimeType: null, fileSize: null }), updatedAt: new Date().toISOString() }).where(and(eq(evidences.id, evidence.id), eq(evidences.status, "draft"))).returning())[0];
  if (evidenceType !== "file" && evidence.storageKey) await deleteEvidenceFile(evidence.storageKey);
  return Response.json({ evidence: updated });
}
export async function DELETE(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const evidence = await ownEvidence((await context.params).evidenceId, student.id);
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia enviada no puede eliminarse." }, { status: 409 });
  await getDb().delete(evidences).where(eq(evidences.id, evidence.id)); return new Response(null, { status: 204 });
}
