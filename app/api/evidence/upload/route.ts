import { and, eq } from "drizzle-orm";
import { getApiProfile } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { classrooms, evidences, enrollments } from "../../../../db/schema";
import { uploadEvidenceFile } from "../../../../lib/storage/evidence-storage";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const studentId = String(form.get("studentId") ?? "").trim();
  const classroomId = String(form.get("classroomId") ?? "").trim();
  if (!(file instanceof File) || !title || !studentId || !classroomId) return Response.json({ error: "Archivo, título, estudiante y aula son obligatorios." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "El archivo no puede superar 10 MB." }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Tipo de archivo no permitido." }, { status: 415 });

  const db = getDb();
  const allowed = await db.select({ studentId: enrollments.studentId }).from(enrollments).innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId)).where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, classroomId), eq(classrooms.teacherId, user.id))).limit(1);
  if (!allowed.length) return Response.json({ error: "El estudiante no está matriculado en un aula del docente actual." }, { status: 403 });
  const evidenceId = crypto.randomUUID();
  const storageKey = `${classroomId}/${studentId}/${evidenceId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await uploadEvidenceFile({ path: storageKey, file, contentType: file.type });
  await db.insert(evidences).values({ id: evidenceId, title, studentId, classroomId, kind: "file", storageKey });
  return Response.json({ evidence: { id: evidenceId, title, storageKey, size: file.size, contentType: file.type } }, { status: 201, headers: { "cache-control": "no-store" } });
}
