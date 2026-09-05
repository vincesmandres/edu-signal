import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { classrooms, evidences, enrollments, learningActivities, learningModules } from "../../../../../../db/schema";
import { validateEvidenceFile, safeEvidenceFilename } from "../../../../../../lib/evidence";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { deleteEvidenceFile, uploadEvidenceFile } from "../../../../../../lib/storage/evidence-storage";
import { recordAudit } from "../../../../../../app/audit";

export async function POST(request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  const evidence = (await getDb().select({ evidence: evidences, activity: learningActivities, module: learningModules, classroom: classrooms })
    .from(evidences).innerJoin(learningActivities, eq(learningActivities.id, evidences.activityId)).innerJoin(learningModules, eq(learningModules.id, evidences.moduleId)).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).innerJoin(enrollments, eq(enrollments.classroomId, classrooms.id))
    .where(and(eq(evidences.id, id), eq(evidences.studentId, student.id), eq(evidences.status, "draft"), eq(enrollments.studentId, student.id), eq(enrollments.status, "active"))).limit(1))[0];
  if (!evidence) return Response.json({ error: "Evidencia no encontrada o bloqueada." }, { status: 404 });
  const file = (await request.formData()).get("file"); if (!(file instanceof File)) return Response.json({ error: "Archivo obligatorio." }, { status: 400 });
  const error = validateEvidenceFile(file); if (error) return Response.json({ error }, { status: 400 });
  const path = `${evidence.classroom.id}/${student.id}/${id}/${safeEvidenceFilename(file.name)}`;
  await uploadEvidenceFile({ path, file, contentType: file.type });
  try {
    const updated = (await getDb().update(evidences).set({ storageKey: path, fileName: safeEvidenceFilename(file.name), mimeType: file.type, fileSize: file.size, updatedAt: new Date().toISOString() }).where(eq(evidences.id, id)).returning())[0];
    if (evidence.evidence.storageKey && evidence.evidence.storageKey !== path) await deleteEvidenceFile(evidence.evidence.storageKey);
    await recordAudit({ actorId: student.profileId ?? student.id, action: "evidence.file_uploaded", entityType: "evidence", entityId: id, metadata: { path, size: file.size, replaced: Boolean(evidence.evidence.storageKey) } });
    return Response.json({ evidence: updated });
  } catch (cause) {
    try { await deleteEvidenceFile(path); } catch { /* best effort compensation */ }
    try {
      await getDb().update(evidences).set({ storageKey: evidence.evidence.storageKey, fileName: evidence.evidence.fileName, mimeType: evidence.evidence.mimeType, fileSize: evidence.evidence.fileSize, updatedAt: new Date().toISOString() }).where(eq(evidences.id, id));
    } catch { /* best effort database compensation */ }
    await recordAudit({ actorId: student.profileId ?? student.id, action: "evidence.file_upload_rollback", entityType: "evidence", entityId: id, metadata: { path } });
    throw cause;
  }
}
