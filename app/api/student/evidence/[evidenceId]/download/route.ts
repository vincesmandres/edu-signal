import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { classrooms, evidences } from "../../../../../../db/schema";
import { createEvidenceDownloadUrl } from "../../../../../../lib/storage/evidence-storage";
import { requireStudent } from "../../../../../../lib/student/require-student";

export async function GET(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  const row = (await getDb().select({ evidence: evidences }).from(evidences).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(and(eq(evidences.id, id), eq(evidences.studentId, student.id))).limit(1))[0];
  if (!row?.evidence.storageKey) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  return Response.json({ url: await createEvidenceDownloadUrl(row.evidence.storageKey) }, { headers: { "cache-control": "no-store" } });
}
