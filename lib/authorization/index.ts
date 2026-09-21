import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { classrooms, enrollments, evidences, rubrics } from "../../db/schema";

export type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function lockStudentDraftEvidence(tx: DbTransaction, studentId: string, evidenceId: string) {
  const candidate = (await tx.select({ evidence: evidences }).from(evidences)
    .where(and(eq(evidences.id, evidenceId), eq(evidences.studentId, studentId))).limit(1))[0];
  if (!candidate) return { evidence: null, reason: "missing" as const };
  const enrollment = (await tx.select({ enrollment: enrollments }).from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, candidate.evidence.classroomId))).for("update").limit(1))[0];
  if (!enrollment || enrollment.enrollment.status !== "active") return { evidence: null, reason: "inactive" as const };
  const locked = (await tx.select({ evidence: evidences }).from(evidences)
    .where(and(eq(evidences.id, evidenceId), eq(evidences.studentId, studentId), eq(evidences.status, "draft"))).for("update").limit(1))[0];
  if (!locked) return { evidence: null, reason: "changed" as const };
  return { evidence: locked.evidence, enrollment: enrollment.enrollment, reason: null };
}

export async function lockActiveEnrollment(tx: DbTransaction, studentId: string, classroomId: string) {
  const row = (await tx.select({ enrollment: enrollments }).from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, classroomId))).for("update").limit(1))[0];
  return row?.enrollment.status === "active" ? row.enrollment : null;
}

export function logAuthorizationOperationError(operation: string) {
  console.error("authorization_operation_failed", { operation });
}

export async function requireTeacherClassroom(teacherId: string, classroomId: string) {
  return (await getDb().select({ classroom: classrooms }).from(classrooms)
    .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId))).limit(1))[0]?.classroom ?? null;
}

export async function requireTeacherEvidence(teacherId: string, evidenceId: string) {
  return (await getDb().select({ evidence: evidences, classroom: classrooms }).from(evidences)
    .innerJoin(classrooms, eq(classrooms.id, evidences.classroomId))
    .where(and(eq(evidences.id, evidenceId), eq(evidences.status, "submitted"), eq(classrooms.teacherId, teacherId))).limit(1))[0] ?? null;
}

export async function requireOwnedRubric(teacherId: string, rubricId: string) {
  return (await getDb().select({ rubric: rubrics, classroom: classrooms }).from(rubrics)
    .innerJoin(classrooms, eq(classrooms.id, rubrics.classroomId))
    .where(and(eq(rubrics.id, rubricId), eq(classrooms.teacherId, teacherId))).limit(1))[0] ?? null;
}

export async function requireStudentEnrollment(studentId: string, classroomId: string) {
  return (await getDb().select({ enrollment: enrollments }).from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classroomId, classroomId), eq(enrollments.status, "active"))).limit(1))[0]?.enrollment ?? null;
}

export async function requireStudentEvidence(studentId: string, evidenceId: string) {
  return (await getDb().select({ evidence: evidences }).from(evidences)
    .innerJoin(enrollments, and(eq(enrollments.classroomId, evidences.classroomId), eq(enrollments.studentId, studentId), eq(enrollments.status, "active")))
    .where(and(eq(evidences.id, evidenceId), eq(evidences.studentId, studentId))).limit(1))[0]?.evidence ?? null;
}
