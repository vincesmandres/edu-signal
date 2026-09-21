import { and, desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, evidences, learningActivities, learningModules, students } from "../../../db/schema";

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const params = new URL(request.url).searchParams;
  const classroomId = params.get("classroomId");
  if (params.get("status") && params.get("status") !== "submitted") return Response.json({ error: "Sólo se pueden consultar evidencias enviadas." }, { status: 422 });
  const db = getDb();
  const rows = await db.select({ evidence: evidences, student: students, classroom: classrooms, module: learningModules, activity: learningActivities })
    .from(evidences)
    .innerJoin(students, eq(students.id, evidences.studentId))
    .innerJoin(classrooms, eq(classrooms.id, evidences.classroomId))
    .leftJoin(learningModules, eq(learningModules.id, evidences.moduleId))
    .leftJoin(learningActivities, eq(learningActivities.id, evidences.activityId))
    .where(classroomId ? and(eq(classrooms.teacherId, user.id), eq(evidences.classroomId, classroomId), eq(evidences.status, "submitted")) : and(eq(classrooms.teacherId, user.id), eq(evidences.status, "submitted")))
    .orderBy(desc(evidences.submittedAt), desc(evidences.id));
  return Response.json({ evidences: rows.map(({ evidence, student, classroom, module, activity }) => ({ id: evidence.id, title: evidence.title, studentName: student.displayName, classroomName: classroom.name, moduleTitle: module?.title ?? null, activityTitle: activity?.title ?? null, evidenceType: evidence.evidenceType, submittedAt: evidence.submittedAt, status: evidence.status })) });
}

export async function POST() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  return Response.json({ error: "La creación docente de evidencias es una ruta histórica de solo lectura." }, { status: 410 });
}
