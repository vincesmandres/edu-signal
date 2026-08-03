import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { classrooms, educators, enrollments, students } from "../../../db/schema";

function id() { return crypto.randomUUID(); }

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const db = getDb();
  const rows = await db.select({ student: students, enrollment: enrollments })
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId))
    .where(eq(classrooms.teacherId, user.userId))
    .orderBy(desc(students.createdAt));
  return Response.json({ students: rows.map(({ student, enrollment }) => ({ ...student, enrollmentId: enrollment.id, classroomId: enrollment.classroomId })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json() as { displayName?: string; email?: string; externalRef?: string; classroomId?: string };
  const displayName = body.displayName?.trim();
  if (!displayName) return Response.json({ error: "El nombre del estudiante es obligatorio." }, { status: 400 });

  const db = getDb();
  await db.insert(educators).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: educators.id, set: { email: user.email, displayName: user.displayName, updatedAt: new Date().toISOString() } });
  if (body.classroomId) {
    const classroom = await db.select({ id: classrooms.id }).from(classrooms).where(and(eq(classrooms.id, body.classroomId), eq(classrooms.teacherId, user.userId))).limit(1);
    if (!classroom.length) return Response.json({ error: "El aula no pertenece al docente actual." }, { status: 403 });
  }
  const studentId = id();
  await db.insert(students).values({ id: studentId, displayName, email: body.email?.trim() || null, externalRef: body.externalRef?.trim() || null });
  if (body.classroomId) await db.insert(enrollments).values({ id: id(), studentId, classroomId: body.classroomId });
  return Response.json({ student: { id: studentId, displayName, email: body.email?.trim() || null, classroomId: body.classroomId ?? null } }, { status: 201 });
}
