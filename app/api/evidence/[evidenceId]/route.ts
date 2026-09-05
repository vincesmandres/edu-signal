import { and, eq } from "drizzle-orm";
import { getApiProfile } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { classrooms, evidences, students } from "../../../../db/schema";

export async function GET(_: Request, context: { params: Promise<{ evidenceId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: "Forbidden" }, { status: auth.status });
  const row = (await getDb().select({ evidence: evidences, student: students }).from(evidences).innerJoin(classrooms, eq(classrooms.id, evidences.classroomId)).innerJoin(students, eq(students.id, evidences.studentId)).where(and(eq(evidences.id, (await context.params).evidenceId), eq(evidences.status, "submitted"), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!row) return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
  return Response.json({ evidence: { ...row.evidence, studentName: row.student.displayName } });
}
