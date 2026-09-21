import { and, eq } from "drizzle-orm";
import { getApiProfile } from "../../../../../lib/auth";
import { getDb } from "../../../../../db";
import { classrooms, evidences, students } from "../../../../../db/schema";
import { createEvidenceDownloadUrl } from "../../../../../lib/storage/evidence-storage";

export async function GET(_request: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const id = (await context.params).evidenceId; const user = auth.profile;
  const row = (await getDb().select({ evidence: evidences }).from(evidences).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).innerJoin(students, eq(students.id, evidences.studentId)).where(and(eq(evidences.id, id), eq(evidences.status, "submitted"), eq(classrooms.teacherId, user.id))).limit(1))[0];
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
