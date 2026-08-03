import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { classrooms, educators, evidences, enrollments } from "../../../../db/schema";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const studentId = String(form.get("studentId") ?? "").trim();
  const classroomId = String(form.get("classroomId") ?? "").trim();
  if (!(file instanceof File) || !title || !studentId || !classroomId) return Response.json({ error: "Archivo, título, estudiante y aula son obligatorios." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "El archivo no puede superar 10 MB." }, { status: 413 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "Tipo de archivo no permitido." }, { status: 415 });

  const db = getDb();
  const allowed = await db.select({ studentId: enrollments.studentId }).from(enrollments).innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId)).where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, classroomId), eq(classrooms.teacherId, user.userId))).limit(1);
  if (!allowed.length) return Response.json({ error: "El estudiante no está matriculado en un aula del docente actual." }, { status: 403 });
  if (!env.EVIDENCE_BUCKET) return Response.json({ error: "El almacenamiento de evidencias no está configurado." }, { status: 503 });

  const evidenceId = crypto.randomUUID();
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  const storageKey = `evidence/${classroomId}/${studentId}/${evidenceId}${extension}`;
  await env.EVIDENCE_BUCKET.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type } });
  await db.insert(educators).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoNothing();
  await db.insert(evidences).values({ id: evidenceId, title, studentId, classroomId, kind: "file", storageKey });
  return Response.json({ evidence: { id: evidenceId, title, storageKey, size: file.size, contentType: file.type } }, { status: 201, headers: { "cache-control": "no-store" } });
}
