import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { classrooms, enrollments, profiles, students } from "../../../../db/schema";
import { getApiProfile } from "../../../../lib/auth";

/**
 * Read-only interoperability export. It deliberately uses a scoped teacher
 * session and emits the stable Edu Signal IDs as sourcedId values.
 */
export async function GET() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const user = auth.profile;

  const db = getDb();
  const [teacher, classes, memberships] = await Promise.all([
    db.select({ id: profiles.id, name: profiles.displayName })
      .from(profiles).where(eq(profiles.id, user.id)).limit(1),
    db.select().from(classrooms).where(eq(classrooms.teacherId, user.id)),
    db.select({ enrollment: enrollments, student: students })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
       .innerJoin(classrooms, and(eq(classrooms.id, enrollments.classroomId), eq(classrooms.teacherId, user.id))),
  ]);

  const now = new Date().toISOString();
  return Response.json({
    sourcedId: `edu-signal:${user.id}`,
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
