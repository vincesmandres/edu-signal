import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, classrooms, enrollments, gradeImports, grades, learningActivities, learningModules, students } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { csvCell, parseCsv } from "@/lib/csv";
import { normalizeGrade } from "@/lib/grades";

const headers = ["student_identifier", "target_type", "target_id", "score", "feedback"];

export async function GET(request: Request, context: { params: Promise<{ classroomId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { classroomId } = await context.params;
  const classroom = (await getDb().select().from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!classroom) return Response.json({ error: "Classroom not found." }, { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  if (format === "template") return new Response(`${headers.join(",")}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="grades-${classroomId}-template.csv"` } });
  const rows = await getDb().select({ grade: grades, studentName: students.displayName, studentEmail: students.email }).from(grades).innerJoin(students, eq(students.id, grades.studentId)).where(and(eq(grades.classroomId, classroomId), eq(grades.status, "published"))).orderBy(desc(grades.publishedAt));
  if (format === "csv") {
    const csv = [["student_identifier", "student_name", "target_type", "target_id", "raw_score", "normalized_percentage", "published_at"], ...rows.map((row) => [row.studentEmail ?? row.grade.studentId, row.studentName, row.grade.targetType, row.grade.targetId, row.grade.rawValue, row.grade.normalizedPercentage, row.grade.publishedAt ?? ""])].map((row) => row.map(csvCell).join(",")).join("\n");
    return new Response(`${csv}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="grades-${classroomId}.csv"` } });
  }
  return Response.json({ grades: rows }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ classroomId: string }> }) {
  const auth = await getApiProfile("teacher"); if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { classroomId } = await context.params;
  const classroom = (await getDb().select().from(classrooms).where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!classroom) return Response.json({ error: "Classroom not found." }, { status: 404 });
  let body: { csv?: unknown; confirm?: unknown; fileName?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body.csv !== "string" || body.csv.length > 2_000_000) return Response.json({ error: "CSV is required and must be smaller than 2 MB." }, { status: 422 });
  let parsed: string[][]; try { parsed = parseCsv(body.csv); } catch { return Response.json({ error: "Malformed CSV." }, { status: 422 }); }
  if (!parsed.length || headers.some((header, index) => parsed[0][index] !== header)) return Response.json({ error: `Expected header: ${headers.join(",")}` }, { status: 422 });
  const scale = { type: (classroom.gradeScaleType === "rubric_levels" ? "numeric_100" : classroom.gradeScaleType) as "numeric_5" | "numeric_10" | "numeric_100", min: Number(classroom.gradeScaleMin), max: Number(classroom.gradeScaleMax), passThreshold: Number(classroom.gradePassThreshold) };
  const valid: Array<{ studentId: string; targetType: "activity" | "module" | "classroom"; targetId: string; score: number; normalized: number; feedback: string }> = []; const errors: Array<{ row: number; reason: string }> = [];
  for (let index = 1; index < parsed.length; index += 1) {
    const [identifier, targetType, targetId, rawScore, feedback = ""] = parsed[index]; const rowNumber = index + 1;
    const student = (await getDb().select({ student: students }).from(students).innerJoin(enrollments, and(eq(enrollments.studentId, students.id), eq(enrollments.classroomId, classroomId), eq(enrollments.status, "active"))).where(or(eq(students.id, identifier), eq(students.email, identifier), eq(students.externalRef, identifier))).limit(1))[0]?.student;
    if (!student) { errors.push({ row: rowNumber, reason: "Unknown or unenrolled student." }); continue; }
    if (!(["activity", "module", "classroom"] as string[]).includes(targetType) || !targetId) { errors.push({ row: rowNumber, reason: "Invalid target." }); continue; }
    let targetOwned = targetType === "classroom" && targetId === classroomId;
    if (targetType === "module") targetOwned = Boolean((await getDb().select({ id: learningModules.id }).from(learningModules).where(and(eq(learningModules.id, targetId), eq(learningModules.classroomId, classroomId))).limit(1))[0]);
    if (targetType === "activity") targetOwned = Boolean((await getDb().select({ id: learningActivities.id }).from(learningActivities).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).where(and(eq(learningActivities.id, targetId), eq(learningModules.classroomId, classroomId))).limit(1))[0]);
    if (!targetOwned) { errors.push({ row: rowNumber, reason: "Target is outside this classroom." }); continue; }
    const score = Number(rawScore); try { valid.push({ studentId: student.id, targetType: targetType as "activity" | "module" | "classroom", targetId, score, normalized: normalizeGrade(score, scale), feedback }); } catch { errors.push({ row: rowNumber, reason: "Score is outside the classroom scale." }); }
  }
  const summary = { accepted: valid.length, rejected: errors.length, errors };
  if (body.confirm !== true) return Response.json({ preview: summary });
  if (errors.length || !valid.length) return Response.json({ error: "Resolve every validation error before confirming.", preview: summary }, { status: 422 });
  const importId = crypto.randomUUID(); const now = new Date().toISOString();
  await getDb().transaction(async (tx) => {
    await tx.insert(gradeImports).values({ id: importId, classroomId, teacherId: auth.profile!.id, fileName: typeof body.fileName === "string" ? body.fileName.slice(0, 120) : "grades.csv", status: "confirmed", validationSummary: summary, auditReference: importId, confirmedAt: now });
    await tx.insert(grades).values(valid.map((row) => ({ id: crypto.randomUUID(), classroomId, studentId: row.studentId, targetType: row.targetType, targetId: row.targetId, rawValue: String(row.score), normalizedPercentage: String(row.normalized), scaleSnapshot: scale, sourceType: "import", sourceImportId: importId, status: "published", publishedAt: now })));
    await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: auth.profile!.id, action: "grades.imported", entityType: "grade_import", entityId: importId, metadata: JSON.stringify({ accepted: valid.length }) });
  });
  return Response.json({ importId, summary }, { status: 201 });
}
