import { and, eq } from "drizzle-orm";
import { getChatGPTUser, sha256 } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { credentials, educators, students, enrollments, classrooms } from "../../../db/schema";
import { recordAudit } from "../../audit";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json() as { studentId?: string; title?: string; achievement?: string; classroomId?: string };
  const title = body.title?.trim(); const achievement = body.achievement?.trim();
  if (!body.studentId || !title || !achievement) return Response.json({ error: "Estudiante, título y logro son obligatorios." }, { status: 400 });
  const db = getDb();
  const allowed = body.classroomId ? await db.select({ studentId: enrollments.studentId }).from(enrollments).innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId)).where(and(eq(enrollments.studentId, body.studentId), eq(enrollments.classroomId, body.classroomId), eq(classrooms.teacherId, user.userId))).limit(1) : await db.select({ id: students.id }).from(students).where(eq(students.id, body.studentId)).limit(1);
  if (!allowed.length) return Response.json({ error: "El estudiante no pertenece al contexto docente actual." }, { status: 403 });
  const id = crypto.randomUUID(); const verificationCode = crypto.randomUUID().replaceAll("-", ""); const issuedAt = new Date().toISOString();
  const unsigned = { "@context": ["https://www.w3.org/ns/credentials/v2"], type: ["VerifiableCredential", "EduSignalAchievementCredential"], id: `urn:uuid:${id}`, issuer: { id: `urn:edu-signal:educator:${user.userId}`, name: user.displayName }, validFrom: issuedAt, credentialSubject: { id: `urn:edu-signal:student:${body.studentId}`, achievement: { name: title, description: achievement } } };
  const credential = { ...unsigned, proof: { type: "EduSignalHashProof", created: issuedAt, proofPurpose: "assertionMethod", proofValue: await sha256(JSON.stringify(unsigned)) } };
  await db.insert(educators).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoNothing();
  await db.insert(credentials).values({ id, studentId: body.studentId, issuerId: user.userId, title, achievement, verificationCode, credentialJson: JSON.stringify(credential) });
  await recordAudit({ actorId: user.userId, action: "credential.issued", entityType: "credential", entityId: id, metadata: { studentId: body.studentId } });
  return Response.json({ credential: { id, title, achievement, verificationCode, verificationUrl: `/verify/${verificationCode}`, status: "issued" } }, { status: 201, headers: { "cache-control": "no-store" } });
}
