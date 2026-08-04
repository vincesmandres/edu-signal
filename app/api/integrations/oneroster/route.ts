import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { classrooms, educators, enrollments, students } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

/**
 * Read-only interoperability export. It deliberately uses a scoped teacher
 * session and emits the stable Edu Signal IDs as sourcedId values.
 */
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const db = getDb();
  const [teacher, classes, memberships] = await Promise.all([
    db.select({ id: educators.id, name: educators.displayName, email: educators.email })
      .from(educators).where(eq(educators.id, user.userId)).limit(1),
    db.select().from(classrooms).where(eq(classrooms.teacherId, user.userId)),
    db.select({ enrollment: enrollments, student: students })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(classrooms, and(eq(classrooms.id, enrollments.classroomId), eq(classrooms.teacherId, user.userId))),
  ]);

  const now = new Date().toISOString();
  return Response.json({
    sourcedId: `edu-signal:${user.userId}`,
    generatedAt: now,
    users: [
      ...(teacher[0] ? [{ sourcedId: teacher[0].id, role: "teacher", ...teacher[0] }] : []),
      ...memberships.map(({ student }) => ({
        sourcedId: student.id,
        role: "student",
        name: student.displayName,
        email: student.email,
        externalRef: student.externalRef,
      })),
    ],
    classes: classes.map((classroom) => ({
      sourcedId: classroom.id,
      title: classroom.name,
      subject: classroom.subject,
      academicPeriod: classroom.academicPeriod,
      status: classroom.status,
      teacherSourcedId: classroom.teacherId,
    })),
    enrollments: memberships.map(({ enrollment }) => ({
      sourcedId: enrollment.id,
      classSourcedId: enrollment.classroomId,
      userSourcedId: enrollment.studentId,
      role: "student",
      status: enrollment.status,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
