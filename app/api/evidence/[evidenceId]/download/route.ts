import { getApiProfile } from "../../../../../lib/auth";
import { createEvidenceDownloadUrl } from "../../../../../lib/storage/evidence-storage";
import { requireTeacherEvidence } from "../../../../../lib/authorization";

export async function GET(_request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const id = (await context.params).evidenceId; const user = auth.profile;
  // requireTeacherEvidence enforces eq(evidences.status, "submitted") and classroom ownership.
  const row = await requireTeacherEvidence(user.id, id);
  if (!row?.evidence.storageKey) return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  try {
    const signedUrl = await createEvidenceDownloadUrl(row.evidence.storageKey);
    const parsed = new URL(signedUrl);
    if (parsed.protocol !== "https:") return Response.json({ error: "No se pudo preparar la descarga." }, { status: 500 });
    return new Response(null, { status: 302, headers: { location: parsed.toString(), "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo preparar la descarga." }, { status: 500 });
  }
}
