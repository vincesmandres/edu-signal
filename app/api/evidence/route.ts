import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { classrooms, educators, evidences, enrollments, students } from "../../../db/schema";

function id() { return crypto.randomUUID(); }

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const classroomId = new URL(request.url).searchParams.get("classroomId");
  const db = getDb();
  const rows = await db.select({ evidence: evidences, student: students })
    .from(evidences)
    .innerJoin(students, eq(students.id, evidences.studentId))
    .innerJoin(classrooms, eq(classrooms.id, evidences.classroomId))
    .where(classroomId ? and(eq(classrooms.teacherId, user.userId), eq(evidences.classroomId, classroomId)) : eq(classrooms.teacherId, user.userId))
    .orderBy(desc(evidences.createdAt));
  return Response.json({ evidences: rows.map(({ evidence, student }) => ({ ...evidence, studentName: student.displayName })) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json() as { title?: string; description?: string; kind?: string; studentId?: string; classroomId?: string; storageKey?: string };
  const title = body.title?.trim();
  if (!title || !body.studentId || !body.classroomId) return Response.json({ error: "Título, estudiante y aula son obligatorios." }, { status: 400 });
  const db = getDb();
  const allowed = await db.select({ studentId: enrollments.studentId }).from(enrollments).innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId)).where(and(eq(enrollments.studentId, body.studentId), eq(enrollments.classroomId, body.classroomId), eq(classrooms.teacherId, user.userId))).limit(1);
  if (!allowed.length) return Response.json({ error: "El estudiante no está matriculado en un aula del docente actual." }, { status: 403 });
  const evidenceId = id();
  await db.insert(educators).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoNothing();
  await db.insert(evidences).values({ id: evidenceId, title, description: body.description?.trim() || null, kind: body.kind?.trim() || "project", studentId: body.studentId, classroomId: body.classroomId, storageKey: body.storageKey?.trim() || null });
  return Response.json({ evidence: { id: evidenceId, title, studentId: body.studentId, classroomId: body.classroomId } }, { status: 201 });
}
