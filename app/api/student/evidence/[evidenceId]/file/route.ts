import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { classrooms, evidences, enrollments, learningActivities, learningModules } from "../../../../../../db/schema";
import { validateEvidenceFile, safeEvidenceFilename } from "../../../../../../lib/evidence";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { cleanupEvidenceFileIfUnreferenced, deleteEvidenceFile, uploadEvidenceFile } from "../../../../../../lib/storage/evidence-storage";
import { recordAudit } from "../../../../../../app/audit";
import { toEvidenceDto } from "../../../../../../lib/evidence-dto";
import { lockStudentDraftEvidence, logAuthorizationOperationError } from "../../../../../../lib/authorization";
import { createEvidenceStoragePath } from "../../../../../../lib/storage/evidence-path";

export async function POST(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  let evidence;
  try {
    evidence = (await getDb().select({ evidence: evidences, activity: learningActivities, module: learningModules, classroom: classrooms })
      .from(evidences).innerJoin(learningActivities, eq(learningActivities.id, evidences.activityId)).innerJoin(learningModules, eq(learningModules.id, evidences.moduleId)).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
      .where(and(eq(evidences.id, id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"), eq(enrollments.studentId, student.id), eq(enrollments.status, "active"))).limit(1))[0];
  } catch { logAuthorizationOperationError("student_evidence_file_lookup"); return Response.json({ error: "No se pudo consultar la evidencia." }, { status: 500 }); }
  if (!evidence) return Response.json({ error: "Evidencia no encontrada o bloqueada." }, { status: 404 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "FormData inválido." }, { status: 400 }); }
  const file = form.get("file"); if (!(file instanceof File)) return Response.json({ error: "Archivo obligatorio." }, { status: 400 });
  const error = validateEvidenceFile(file); if (error) return Response.json({ error }, { status: 400 });
  const path = createEvidenceStoragePath(evidence.classroom.id, student.id, id, file.name);
  try { await uploadEvidenceFile({ path, file, contentType: file.type }); } catch { return Response.json({ error: "No se pudo cargar el archivo." }, { status: 500 }); }
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await lockStudentDraftEvidence(tx, student.id, id);
      if (!locked.evidence) return locked;
      const updated = (await tx.update(evidences).set({ storageKey: path, fileName: safeEvidenceFilename(file.name), mimeType: file.type, fileSize: file.size, updatedAt: new Date().toISOString() }).where(and(eq(evidences.id, id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"), eq(evidences.updatedAt, locked.evidence.updatedAt))).returning())[0];
      return updated ? { ...locked, updated } : { evidence: null, reason: "changed" as const };
    });
    if (!result.evidence) { try { await deleteEvidenceFile(path); } catch { logAuthorizationOperationError("student_evidence_file_cleanup"); } return Response.json({ error: result.reason === "inactive" ? "El enrollment no está activo." : "La evidencia cambió de estado." }, { status: result.reason === "inactive" ? 422 : result.reason === "missing" ? 404 : 409 }); }
    if (evidence.evidence.storageKey && evidence.evidence.storageKey !== path) await cleanupEvidenceFileIfUnreferenced(evidence.evidence.storageKey);
    await recordAudit({ actorId: student.profileId ?? student.id, action: "evidence.file_uploaded", entityType: "evidence", entityId: id, metadata: { path, size: file.size, replaced: Boolean(evidence.evidence.storageKey) } });
    return Response.json({ evidence: toEvidenceDto(result.updated) });
  } catch {
    // file_upload_rollback deletes only the new object; it never restores concurrent metadata.
    // No best effort database compensation is attempted because it could overwrite a newer state.
    try { await deleteEvidenceFile(path); } catch { /* best effort compensation */ }
    logAuthorizationOperationError("student_evidence_file");
    return Response.json({ error: "No se pudo guardar el archivo." }, { status: 500 });
  }
}
