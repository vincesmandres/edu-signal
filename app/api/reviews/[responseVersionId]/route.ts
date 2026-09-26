import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityAttempts, activityResponseVersions, activityRubrics, classrooms, formativeFeedback, learningActivities, learningModules, rubricCriteria, rubrics, selfAssessmentCriteria, selfAssessments, students, teacherReviewCriteria, teacherReviews } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ responseVersionId: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { responseVersionId } = await context.params;
  const current = (await getDb().select({ version: activityResponseVersions, attempt: activityAttempts, activity: learningActivities, classroom: classrooms, student: students })
    .from(activityResponseVersions).innerJoin(activityAttempts, eq(activityAttempts.id, activityResponseVersions.attemptId)).innerJoin(learningActivities, eq(learningActivities.id, activityAttempts.activityId)).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).innerJoin(students, eq(students.id, activityAttempts.studentId))
    .where(and(eq(activityResponseVersions.id, responseVersionId), eq(classrooms.teacherId, auth.profile.id))).limit(1))[0];
  if (!current) return Response.json({ error: "Submission not found." }, { status: 404 });
  const versions = await getDb().select().from(activityResponseVersions).where(and(eq(activityResponseVersions.attemptId, current.attempt.id), eq(activityResponseVersions.status, "submitted"))).orderBy(asc(activityResponseVersions.revision));
  const feedback = (await getDb().select().from(formativeFeedback).where(eq(formativeFeedback.responseVersionId, responseVersionId)).limit(1))[0] ?? null;
  const self = (await getDb().select().from(selfAssessments).where(eq(selfAssessments.responseVersionId, responseVersionId)).limit(1))[0] ?? null;
  const selfCriteria = self ? await getDb().select().from(selfAssessmentCriteria).where(eq(selfAssessmentCriteria.selfAssessmentId, self.id)) : [];
  const criteria = await getDb().select({ id: rubricCriteria.id, name: rubricCriteria.name, description: rubricCriteria.description, maxScore: rubricCriteria.maxScore })
    .from(activityRubrics).innerJoin(rubrics, eq(rubrics.id, activityRubrics.rubricId)).innerJoin(rubricCriteria, eq(rubricCriteria.rubricId, rubrics.id)).where(eq(activityRubrics.activityId, current.activity.id));
  const review = (await getDb().select().from(teacherReviews).where(eq(teacherReviews.responseVersionId, responseVersionId)).limit(1))[0] ?? null;
  const reviewCriteria = review ? await getDb().select().from(teacherReviewCriteria).where(eq(teacherReviewCriteria.reviewId, review.id)) : [];
  return Response.json({ current, versions, feedback, selfAssessment: self ? { ...self, criteria: selfCriteria } : null, rubric: criteria, review: review ? { ...review, criteria: reviewCriteria } : null }, { headers: { "cache-control": "no-store" } });
}
