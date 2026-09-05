import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, evidences, students } from "../../../db/schema";

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const classroomId = new URL(request.url).searchParams.get("classroomId");
  const db = getDb();
  const rows = await db.select({ evidence: evidences, student: students })
    .from(evidences)
    .innerJoin(students, eq(students.id, evidences.studentId))
    .innerJoin(classrooms, eq(classrooms.id, evidences.classroomId))
    .where(classroomId ? and(eq(classrooms.teacherId, user.id), eq(evidences.classroomId, classroomId), eq(evidences.status, "submitted")) : and(eq(classrooms.teacherId, user.id), eq(evidences.status, "submitted")))
    .orderBy(desc(evidences.createdAt));
  return Response.json({ evidences: rows.map(({ evidence, student }) => ({ ...evidence, studentName: student.displayName })) });
}

export async function POST() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  return Response.json({ error: "La creación docente de evidencias es una ruta histórica de solo lectura." }, { status: 410 });
}
