import { desc, eq } from "drizzle-orm";
import { getApiProfile } from "../../../lib/auth";
import { getDb } from "../../../db";
import { classrooms, learningModules, assessments } from "../../../db/schema";
import { recordAudit } from "../../audit";

function id() { return crypto.randomUUID(); }

export async function GET() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const db = getDb();
  const rows = await db.select({ classroom: classrooms, moduleId: learningModules.id }).from(classrooms).leftJoin(learningModules, eq(learningModules.classroomId, classrooms.id)).where(eq(classrooms.teacherId, user.id)).orderBy(desc(classrooms.createdAt));
  const grouped = new Map<string, typeof rows[number]["classroom"] & { moduleId?: string }>();
  for (const row of rows) grouped.set(row.classroom.id, { ...row.classroom, moduleId: row.moduleId ?? undefined });
  return Response.json({ classrooms: [...grouped.values()] });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { name?: string; subject?: string; academicPeriod?: string; moduleTitle?: string; drivingQuestion?: string; methodologies?: string[]; assessmentTitle?: string; assessmentFormat?: string; criteria?: string };
  const name = body.name?.trim(); const subject = body.subject?.trim(); const academicPeriod = body.academicPeriod?.trim();
  if (!name || !subject || !academicPeriod) return Response.json({ error: "Nombre, asignatura y período son obligatorios." }, { status: 400 });
  const classroomId = id();
  const moduleId = body.moduleTitle?.trim() && body.drivingQuestion?.trim() ? id() : null;
  await getDb().transaction(async (tx) => {
    await tx.insert(classrooms).values({ id: classroomId, name, subject, academicPeriod, teacherId: user.id });
    if (moduleId) {
      await tx.insert(learningModules).values({ id: moduleId, classroomId, title: body.moduleTitle!.trim(), drivingQuestion: body.drivingQuestion!.trim(), methodologies: JSON.stringify(body.methodologies ?? []), phase: "draft" });
      if (body.assessmentTitle?.trim() && body.assessmentFormat?.trim() && body.criteria?.trim()) await tx.insert(assessments).values({ id: id(), moduleId, title: body.assessmentTitle.trim(), format: body.assessmentFormat.trim(), criteria: body.criteria.trim() });
    }
  });
  await recordAudit({ actorId: user.id, action: "classroom.created", entityType: "classroom", entityId: classroomId, metadata: { subject, academicPeriod } });
  return Response.json({ classroom: { id: classroomId, name, subject, academicPeriod, moduleId } }, { status: 201 });
}
