import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { evidences } from "../../../../../../db/schema";
import { validateEvidenceContent } from "../../../../../../lib/evidence";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { requireStudentEvidence } from "../../../../../../lib/authorization";
import { toEvidenceDto } from "../../../../../../lib/evidence-dto";
import { lockStudentDraftEvidence, logAuthorizationOperationError } from "../../../../../../lib/authorization";

export async function POST(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  let evidence;
  try { evidence = await requireStudentEvidence(student.id, id); } catch { logAuthorizationOperationError("student_evidence_submit_lookup"); return Response.json({ error: "No se pudo consultar la evidencia." }, { status: 500 }); }
  if (!evidence) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  if (evidence.status !== "draft") return Response.json({ error: "La evidencia ya fue enviada." }, { status: 409 });
  const error = validateEvidenceContent(evidence); if (error) return Response.json({ error }, { status: 400 });
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await lockStudentDraftEvidence(tx, student.id, id);
      if (!locked.evidence) return locked;
      const updated = (await tx.update(evidences).set({ status: "submitted", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(and(eq(evidences.id, id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"))).returning())[0];
      return updated ? { ...locked, updated } : { evidence: null, reason: "changed" as const };
    });
    if (!result.evidence) return Response.json({ error: result.reason === "inactive" ? "El enrollment no está activo." : "La evidencia cambió de estado." }, { status: result.reason === "inactive" ? 422 : result.reason === "missing" ? 404 : 409 });
    return Response.json({ evidence: toEvidenceDto(result.updated) });
  } catch {
    logAuthorizationOperationError("student_evidence_submit");
    return Response.json({ error: "No se pudo enviar la evidencia." }, { status: 500 });
  }
}
