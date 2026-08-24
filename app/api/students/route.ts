import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, enrollments, students } from "../../../db/schema";
import { recordAudit } from "../../audit";

function id() { return crypto.randomUUID(); }

export async function GET() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const db = getDb();
  const rows = await db.select({ student: students, enrollment: enrollments })
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId))
     .where(eq(classrooms.teacherId, user.id))
    .orderBy(desc(students.createdAt));
  return Response.json({ students: rows.map(({ student, enrollment }) => ({ ...student, enrollmentId: enrollment.id, classroomId: enrollment.classroomId })) });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { displayName?: string; email?: string; externalRef?: string; classroomId?: string };
  const displayName = body.displayName?.trim();
  if (!displayName) return Response.json({ error: "El nombre del estudiante es obligatorio." }, { status: 400 });

  const db = getDb();
  if (body.classroomId) {
    const classroom = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, body.classroomId), eq(classrooms.teacherId, user.id))).limit(1);
    if (!classroom.length) return Response.json({ error: "El aula no pertenece al docente actual." }, { status: 403 });
  }
  const studentId = id();
  await db.insert(students).values({ id: studentId, displayName, email: body.email?.trim() || null, externalRef: body.externalRef?.trim() || null });
  if (body.classroomId) await db.insert(enrollments).values({ id: id(), studentId, classroomId: body.classroomId });
  await recordAudit({ actorId: user.id, action: "student.created", entityType: "student", entityId: studentId, metadata: { classroomId: body.classroomId ?? null } });
  return Response.json({ student: { id: studentId, displayName, email: body.email?.trim() || null, classroomId: body.classroomId ?? null } }, { status: 201 });
}
