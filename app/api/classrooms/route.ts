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
  const rows = await db.select().from(classrooms).where(eq(classrooms.teacherId, user.id)).orderBy(desc(classrooms.createdAt));
  return Response.json({ classrooms: rows });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;
  const body = await request.json() as { name?: string; subject?: string; academicPeriod?: string; moduleTitle?: string; drivingQuestion?: string; methodologies?: string[]; assessmentTitle?: string; assessmentFormat?: string; criteria?: string };
  const name = body.name?.trim(); const subject = body.subject?.trim(); const academicPeriod = body.academicPeriod?.trim();
  if (!name || !subject || !academicPeriod) return Response.json({ error: "Nombre, asignatura y período son obligatorios." }, { status: 400 });
  const db = getDb();
  const classroomId = id();
  await db.insert(classrooms).values({ id: classroomId, name, subject, academicPeriod, teacherId: user.id });
  let moduleId: string | null = null;
  if (body.moduleTitle?.trim() && body.drivingQuestion?.trim()) {
    moduleId = id();
    await db.insert(learningModules).values({ id: moduleId, classroomId, title: body.moduleTitle.trim(), drivingQuestion: body.drivingQuestion.trim(), methodologies: JSON.stringify(body.methodologies ?? []), phase: "draft" });
    if (body.assessmentTitle?.trim() && body.assessmentFormat?.trim() && body.criteria?.trim()) await db.insert(assessments).values({ id: id(), moduleId, title: body.assessmentTitle.trim(), format: body.assessmentFormat.trim(), criteria: body.criteria.trim() });
  }
  await recordAudit({ actorId: user.id, action: "classroom.created", entityType: "classroom", entityId: classroomId, metadata: { subject, academicPeriod } });
  return Response.json({ classroom: { id: classroomId, name, subject, academicPeriod, moduleId } }, { status: 201 });
}
