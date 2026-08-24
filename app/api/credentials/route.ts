import { and, eq } from "drizzle-orm";
import { sha256 } from "../../../lib/crypto";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { credentials, students, enrollments, classrooms } from "../../../db/schema";
import { recordAudit } from "../../audit";

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { studentId?: string; title?: string; achievement?: string; classroomId?: string };
  const title = body.title?.trim(); const achievement = body.achievement?.trim();
  if (!body.studentId || !title || !achievement) return Response.json({ error: "Estudiante, título y logro son obligatorios." }, { status: 400 });
  const db = getDb();
  const allowed = body.classroomId ? await db.select({ studentId: enrollments.studentId }).from(enrollments).innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId)).where(and(eq(enrollments.studentId, body.studentId), eq(enrollments.classroomId, body.classroomId), eq(classrooms.teacherId, user.id))).limit(1) : await db.select({ id: students.id }).from(students).where(eq(students.id, body.studentId)).limit(1);
  if (!allowed.length) return Response.json({ error: "El estudiante no pertenece al contexto docente actual." }, { status: 403 });
  const id = crypto.randomUUID(); const verificationCode = crypto.randomUUID().replaceAll("-", ""); const issuedAt = new Date().toISOString();
  const unsigned = { "@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiableCredential", "EduSignalAchievementCredential"], id: `urn:uuid:${id}`, issuer: { id: `urn:edu-signal:profile:${user.id}`, name: user.displayName }, validFrom: issuedAt, credentialSubject: { id: `urn:edu-signal:student:${body.studentId}`, achievement: { name: title, description: achievement } } };
  const credential = { ...unsigned, proof: { type: "EduSignalHashProof", created: issuedAt, proofPurpose: "assertionMethod", proofValue: await sha256(JSON.stringify(unsigned)) } };
  await db.insert(credentials).values({ id, studentId: body.studentId, issuerId: user.id, title, achievement, verificationCode, credentialJson: JSON.stringify(credential) });
  await recordAudit({ actorId: user.id, action: "credential.issued", entityType: "credential", entityId: id, metadata: { studentId: body.studentId } });
  return Response.json({ credential: { id, title, achievement, verificationCode, verificationUrl: `/verify/${verificationCode}`, status: "issued" } }, { status: 201, headers: { "cache-control": "no-store" } });
}
