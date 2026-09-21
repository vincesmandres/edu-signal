import { and, eq } from "drizzle-orm";
import { sha256 } from "../../../lib/crypto";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, credentials, students, enrollments, auditEvents } from "../../../db/schema";
import { requireTeacherClassroom } from "../../../lib/authorization";

class CredentialAuthorizationError extends Error {
  constructor(public readonly status: 403 | 404 | 422, message: string) { super(message); }
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  let body: { studentId?: unknown; title?: unknown; achievement?: unknown; classroomId?: unknown };
  try { const parsed: unknown = await request.json(); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "JSON inválido." }, { status: 400 }); body = parsed as typeof body; } catch { return Response.json({ error: "JSON inválido." }, { status: 400 }); }
  if (typeof body.studentId !== "string" || typeof body.classroomId !== "string" || typeof body.title !== "string" || typeof body.achievement !== "string") return Response.json({ error: "Estudiante, aula, título y logro son obligatorios." }, { status: 400 });
  const title = body.title?.trim(); const achievement = body.achievement?.trim();
  if (!body.studentId.trim() || !body.classroomId.trim() || !title || !achievement) return Response.json({ error: "Estudiante, aula, título y logro son obligatorios." }, { status: 400 });
  const studentId = body.studentId;
  const classroomId = body.classroomId;
  const db = getDb();
  if (!(await requireTeacherClassroom(user.id, body.classroomId))) return Response.json({ error: "El aula no pertenece al docente actual." }, { status: 403 });
  const enrollment = (await db.select({ enrollment: enrollments, student: students }).from(enrollments).innerJoin(students, eq(students.id, enrollments.studentId)).where(and(eq(enrollments.studentId, body.studentId), eq(enrollments.classroomId, body.classroomId))).limit(1))[0];
  if (!enrollment) return Response.json({ error: "Estudiante no encontrado en el aula." }, { status: 404 });
  if (enrollment.enrollment.status !== "active") return Response.json({ error: "El enrollment del estudiante no está activo." }, { status: 422 });
  const id = crypto.randomUUID(); const verificationCode = crypto.randomUUID().replaceAll("-", ""); const issuedAt = new Date().toISOString();
  const unsigned = { "@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiableCredential", "EduSignalAchievementCredential"], id: `urn:uuid:${id}`, issuer: { id: `urn:edu-signal:profile:${user.id}`, name: user.displayName }, validFrom: issuedAt, credentialSubject: { id: `urn:edu-signal:student:${body.studentId}`, achievement: { name: title, description: achievement } } };
  const credential = { ...unsigned, proof: { type: "EduSignalHashProof", created: issuedAt, proofPurpose: "assertionMethod", proofValue: await sha256(JSON.stringify(unsigned)) } };
  try {
    await db.transaction(async (tx) => {
      const ownedClassroom = (await tx.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, user.id))).for("update").limit(1))[0];
      if (!ownedClassroom) throw new CredentialAuthorizationError(403, "El aula no pertenece al docente actual.");
      const currentEnrollment = (await tx.select({ status: enrollments.status }).from(enrollments).where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, classroomId))).for("update").limit(1))[0];
      if (!currentEnrollment) throw new CredentialAuthorizationError(404, "Estudiante no encontrado en el aula.");
      if (currentEnrollment.status !== "active") throw new CredentialAuthorizationError(422, "El enrollment del estudiante no está activo.");
      await tx.insert(credentials).values({ id, studentId, issuerId: user.id, title, achievement, verificationCode, credentialJson: JSON.stringify(credential) });
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: user.id, action: "credential.issued", entityType: "credential", entityId: id, metadata: JSON.stringify({ studentId, classroomId }) });
    });
  } catch (error) {
    if (error instanceof CredentialAuthorizationError) return Response.json({ error: error.message }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") return Response.json({ error: "La credencial ya existe." }, { status: 409 });
    return Response.json({ error: "No se pudo emitir la credencial." }, { status: 500 });
  }
  return Response.json({ credential: { id, title, achievement, verificationCode, verificationUrl: `/verify/${verificationCode}`, status: "issued" } }, { status: 201, headers: { "cache-control": "no-store" } });
}
