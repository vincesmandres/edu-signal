import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { classrooms, educators, learningModules, assessments } from "../../../db/schema";

function id() { return crypto.randomUUID(); }

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const db = getDb();
  const rows = await db.select().from(classrooms).where(eq(classrooms.teacherId, user.userId)).orderBy(desc(classrooms.createdAt));
  return Response.json({ classrooms: rows });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });
  const body = await request.json() as { name?: string; subject?: string; academicPeriod?: string; moduleTitle?: string; drivingQuestion?: string; methodologies?: string[]; assessmentTitle?: string; assessmentFormat?: string; criteria?: string };
  const name = body.name?.trim(); const subject = body.subject?.trim(); const academicPeriod = body.academicPeriod?.trim();
  if (!name || !subject || !academicPeriod) return Response.json({ error: "Nombre, asignatura y período son obligatorios." }, { status: 400 });
  const db = getDb();
  await db.insert(educators).values({ id: user.userId, email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: educators.id, set: { email: user.email, displayName: user.displayName, updatedAt: new Date().toISOString() } });
  const classroomId = id();
  await db.insert(classrooms).values({ id: classroomId, name, subject, academicPeriod, teacherId: user.userId });
  let moduleId: string | null = null;
  if (body.moduleTitle?.trim() && body.drivingQuestion?.trim()) {
    moduleId = id();
    await db.insert(learningModules).values({ id: moduleId, classroomId, title: body.moduleTitle.trim(), drivingQuestion: body.drivingQuestion.trim(), methodologies: JSON.stringify(body.methodologies ?? []), phase: "draft" });
    if (body.assessmentTitle?.trim() && body.assessmentFormat?.trim() && body.criteria?.trim()) await db.insert(assessments).values({ id: id(), moduleId, title: body.assessmentTitle.trim(), format: body.assessmentFormat.trim(), criteria: body.criteria.trim() });
  }
  return Response.json({ classroom: { id: classroomId, name, subject, academicPeriod, moduleId } }, { status: 201 });
}
