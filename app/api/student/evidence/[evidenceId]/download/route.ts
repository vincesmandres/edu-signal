import { createEvidenceDownloadUrl } from "../../../../../../lib/storage/evidence-storage";
import { requireStudent } from "../../../../../../lib/student/require-student";
import { requireStudentEvidence } from "../../../../../../lib/authorization";

export async function GET(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await context.params).evidenceId;
  const evidence = await requireStudentEvidence(student.id, id);
  if (!evidence?.storageKey) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  try { return Response.json({ url: await createEvidenceDownloadUrl(evidence.storageKey) }, { headers: { "cache-control": "no-store" } }); }
  catch { return Response.json({ error: "No se pudo preparar la descarga." }, { status: 500 }); }
}
