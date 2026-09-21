import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { evidences } from "../../../../../db/schema";
import { validateEvidenceContent } from "../../../../../lib/evidence";
import { requireStudent } from "../../../../../lib/student/require-student";
import { requireStudentEvidence } from "../../../../../lib/authorization";
import { cleanupEvidenceFileIfUnreferenced } from "../../../../../lib/storage/evidence-storage";
import { toEvidenceDto } from "../../../../../lib/evidence-dto";
import { lockStudentDraftEvidence, logAuthorizationOperationError } from "../../../../../lib/authorization";

async function ownEvidence(id: string, studentId: string) { return requireStudentEvidence(studentId, id); }
export async function GET(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const evidence = await ownEvidence((await context.params).evidenceId, student.id);
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 }); return Response.json({ evidence: toEvidenceDto(evidence) });
}
export async function PATCH(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent();
  let evidence;
  try { evidence = await ownEvidence((await context.params).evidenceId, student.id); } catch { logAuthorizationOperationError("student_evidence_patch_lookup"); return Response.json({ error: "No se pudo consultar la evidencia." }, { status: 500 }); }
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia enviada es inmutable." }, { status: 409 });
  let body: { title?: unknown; description?: unknown; evidenceType?: unknown; textContent?: unknown; externalUrl?: unknown };
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "JSON inválido." }, { status: 400 }); body = parsed as typeof body; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : evidence.title;
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const evidenceType = typeof body.evidenceType === "string" ? body.evidenceType : evidence.evidenceType;
  const textContent = typeof body.textContent === "string" ? body.textContent.trim() || null : null;
  const externalUrl = typeof body.externalUrl === "string" ? body.externalUrl.trim() || null : null;
  const values = { title, description, evidenceType, textContent: evidenceType === "text" ? textContent : null, externalUrl: evidenceType === "link" ? externalUrl : null };
  const error = validateEvidenceContent({ ...values, storageKey: evidenceType === "file" ? evidence.storageKey : null });
  if (error) return Response.json({ error }, { status: 400 });
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await lockStudentDraftEvidence(tx, student.id, evidence.id);
      if (!locked.evidence) return locked;
      const updated = (await tx.update(evidences).set({ ...values, ...(evidenceType === "file" ? {} : { storageKey: null, fileName: null, mimeType: null, fileSize: null }), updatedAt: new Date().toISOString() }).where(and(eq(evidences.id, evidence.id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"), eq(evidences.updatedAt, locked.evidence.updatedAt))).returning())[0];
      return updated ? { ...locked, updated } : { evidence: null, reason: "changed" as const };
    });
    if (!result.evidence) return Response.json({ error: result.reason === "inactive" ? "El enrollment no está activo." : "La evidencia cambió de estado." }, { status: result.reason === "inactive" ? 422 : result.reason === "missing" ? 404 : 409 });
    if (evidenceType !== "file" && evidence.storageKey) await cleanupEvidenceFileIfUnreferenced(evidence.storageKey);
    return Response.json({ evidence: toEvidenceDto(result.updated) });
  } catch {
    logAuthorizationOperationError("student_evidence_patch");
    return Response.json({ error: "No se pudo actualizar la evidencia." }, { status: 500 });
  }
}
export async function DELETE(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent();
  let evidence;
  try { evidence = await ownEvidence((await context.params).evidenceId, student.id); } catch { logAuthorizationOperationError("student_evidence_delete_lookup"); return Response.json({ error: "No se pudo consultar la evidencia." }, { status: 500 }); }
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia enviada no puede eliminarse." }, { status: 409 });
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await lockStudentDraftEvidence(tx, student.id, evidence.id);
      if (!locked.evidence) return locked;
      const deleted = (await tx.delete(evidences).where(and(eq(evidences.id, evidence.id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"))).returning({ id: evidences.id, storageKey: evidences.storageKey }))[0];
      return deleted ? { ...locked, deleted } : { evidence: null, reason: "changed" as const };
    });
    if (!result.evidence) return Response.json({ error: result.reason === "inactive" ? "El enrollment no está activo." : "La evidencia cambió de estado." }, { status: result.reason === "inactive" ? 422 : result.reason === "missing" ? 404 : 409 });
    if (result.deleted.storageKey) await cleanupEvidenceFileIfUnreferenced(result.deleted.storageKey);
    return new Response(null, { status: 204 });
  } catch {
    logAuthorizationOperationError("student_evidence_delete");
    return Response.json({ error: "No se pudo eliminar la evidencia." }, { status: 500 });
  }
}
