import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityAttempts, activityResponseVersions, activityRubrics, auditEvents, classrooms, grades, learningActivities, learningModules, rubricCriteria, rubrics, students, teacherReviewCriteria, teacherReviews } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { denormalizeGrade } from "@/lib/grades";

type ReviewBody = {
  responseVersionId?: unknown;
  status?: unknown;
  publicFeedback?: unknown;
  privateNotes?: unknown;
  requiredImprovements?: unknown;
  scores?: unknown;
};

class ReviewError extends Error {
  constructor(message: string, public readonly statusCode: number) { super(message); }
}

async function reviewContext(responseVersionId: string, teacherId: string) {
  return (await getDb().select({ version: activityResponseVersions, attempt: activityAttempts, activity: learningActivities, classroom: classrooms, student: students })
    .from(activityResponseVersions).innerJoin(activityAttempts, eq(activityAttempts.id, activityResponseVersions.attemptId)).innerJoin(learningActivities, eq(learningActivities.id, activityAttempts.activityId)).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).innerJoin(students, eq(students.id, activityAttempts.studentId))
    .where(and(eq(activityResponseVersions.id, responseVersionId), eq(activityResponseVersions.status, "submitted"), eq(classrooms.teacherId, teacherId))).limit(1))[0] ?? null;
}

export async function GET(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const status = new URL(request.url).searchParams.get("status");
  const rows = await getDb().select({ review: teacherReviews, version: activityResponseVersions, attempt: activityAttempts, activity: learningActivities, classroom: classrooms, student: students })
    .from(activityResponseVersions).innerJoin(activityAttempts, eq(activityAttempts.id, activityResponseVersions.attemptId)).innerJoin(learningActivities, eq(learningActivities.id, activityAttempts.activityId)).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).innerJoin(students, eq(students.id, activityAttempts.studentId)).leftJoin(teacherReviews, eq(teacherReviews.responseVersionId, activityResponseVersions.id))
    .where(and(eq(classrooms.teacherId, auth.profile.id), eq(activityResponseVersions.status, "submitted"))).orderBy(desc(activityResponseVersions.submittedAt));
  const reviews = rows.filter((row) => !status || (status === "new" ? !row.review : row.review?.status === status));
  return Response.json({ reviews }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  let body: ReviewBody;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body.responseVersionId !== "string" || !["draft", "returned", "published"].includes(String(body.status))) return Response.json({ error: "Invalid review request." }, { status: 422 });
  const context = await reviewContext(body.responseVersionId, auth.profile.id);
  if (!context) return Response.json({ error: "Submission not found." }, { status: 404 });
  const requiredImprovements = Array.isArray(body.requiredImprovements) && body.requiredImprovements.every((item) => typeof item === "string" && item.trim()) ? body.requiredImprovements.map((item) => String(item).trim()) : [];
  const scores = Array.isArray(body.scores) ? body.scores as Array<{ criterionId?: unknown; score?: unknown; feedback?: unknown }> : [];
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = (await tx.select({ version: activityResponseVersions, attempt: activityAttempts, activity: learningActivities, classroom: classrooms })
        .from(activityResponseVersions).innerJoin(activityAttempts, eq(activityAttempts.id, activityResponseVersions.attemptId)).innerJoin(learningActivities, eq(learningActivities.id, activityAttempts.activityId)).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
        .where(and(eq(activityResponseVersions.id, body.responseVersionId as string), eq(classrooms.teacherId, auth.profile!.id))).for("update").limit(1))[0];
      if (!locked || locked.version.status !== "submitted") throw new ReviewError("Submission changed concurrently.", 409);
      const rubricRows = await tx.select({ criterion: rubricCriteria }).from(activityRubrics).innerJoin(rubrics, eq(rubrics.id, activityRubrics.rubricId)).innerJoin(rubricCriteria, eq(rubricCriteria.rubricId, rubrics.id)).where(eq(activityRubrics.activityId, locked.activity.id));
      const criteria = rubricRows.map((row) => row.criterion);
      const scoreMap = new Map(scores.map((score) => [score.criterionId, score]));
      if (body.status === "published") {
        if (!criteria.length || scores.length !== criteria.length || criteria.some((criterion) => {
          const score = scoreMap.get(criterion.id); const value = Number(score?.score);
          return !score || !Number.isFinite(value) || value < 0 || value > Number(criterion.maxScore);
        })) throw new ReviewError("Every rubric criterion requires a valid score.", 422);
      }
      if (body.status === "returned" && (!requiredImprovements.length || locked.attempt.currentRevision >= locked.attempt.revisionLimit)) throw new ReviewError("Required improvements or revision capacity are missing.", 422);
      const existing = (await tx.select().from(teacherReviews).where(and(eq(teacherReviews.responseVersionId, locked.version.id), eq(teacherReviews.status, "draft"))).for("update").limit(1))[0];
      const reviewId = existing?.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      if (existing) await tx.update(teacherReviews).set({ status: body.status as string, publicFeedback: typeof body.publicFeedback === "string" ? body.publicFeedback.trim() || null : null, privateNotes: typeof body.privateNotes === "string" ? body.privateNotes.trim() || null : null, requiredImprovements, returnedAt: body.status === "returned" ? now : null, publishedAt: body.status === "published" ? now : null, updatedAt: now }).where(eq(teacherReviews.id, reviewId));
      else await tx.insert(teacherReviews).values({ id: reviewId, responseVersionId: locked.version.id, teacherId: auth.profile!.id, status: body.status as string, publicFeedback: typeof body.publicFeedback === "string" ? body.publicFeedback.trim() || null : null, privateNotes: typeof body.privateNotes === "string" ? body.privateNotes.trim() || null : null, requiredImprovements, returnedAt: body.status === "returned" ? now : null, publishedAt: body.status === "published" ? now : null });
      await tx.delete(teacherReviewCriteria).where(eq(teacherReviewCriteria.reviewId, reviewId));
      if (scores.length) await tx.insert(teacherReviewCriteria).values(scores.map((score) => ({ id: crypto.randomUUID(), reviewId, criterionId: String(score.criterionId), score: String(score.score), feedback: typeof score.feedback === "string" ? score.feedback.trim() || null : null })));
      if (body.status === "returned") {
        const revision = locked.attempt.currentRevision + 1;
        await tx.update(activityAttempts).set({ status: "returned", currentRevision: revision, updatedAt: now }).where(eq(activityAttempts.id, locked.attempt.id));
        const priorStages = locked.version.stageResponses as Record<string, unknown>;
        await tx.insert(activityResponseVersions).values({ id: crypto.randomUUID(), attemptId: locked.attempt.id, revision, status: "draft", stageResponses: { ...priorStages, aiUse: { used: false } }, aiUseDeclaration: { used: false } });
      }
      let gradeId: string | null = null;
      if (body.status === "published") {
        const earned = criteria.reduce((sum, criterion) => sum + Number(scoreMap.get(criterion.id)!.score), 0);
        const possible = criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore), 0);
        const normalized = Math.round((earned / possible) * 10_000) / 100;
        const scaleBounds = { min: Number(locked.classroom.gradeScaleMin), max: Number(locked.classroom.gradeScaleMax), passThreshold: Number(locked.classroom.gradePassThreshold) };
        const levelCount = Math.max(2, Math.min(10, Math.round(scaleBounds.max - scaleBounds.min + 1)));
        const scale = locked.classroom.gradeScaleType === "rubric_levels"
          ? { type: "rubric_levels" as const, ...scaleBounds, levels: Array.from({ length: levelCount }, (_, index) => `Nivel ${index + 1}`) }
          : { type: locked.classroom.gradeScaleType as "numeric_5" | "numeric_10" | "numeric_100", ...scaleBounds };
        const rawValue = denormalizeGrade(normalized, scale);
        gradeId = crypto.randomUUID();
        await tx.insert(grades).values({ id: gradeId, classroomId: locked.classroom.id, studentId: locked.attempt.studentId, targetType: "activity", targetId: locked.activity.id, rawValue: String(rawValue), normalizedPercentage: String(normalized), scaleSnapshot: scale, sourceType: "review", sourceReviewId: reviewId, status: "published", publishedAt: now });
        await tx.update(activityAttempts).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(activityAttempts.id, locked.attempt.id));
      }
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: auth.profile!.id, action: `teacher_review.${body.status}`, entityType: "teacher_review", entityId: reviewId, metadata: JSON.stringify({ responseVersionId: locked.version.id, gradeId }) });
      return { reviewId, gradeId };
    });
    return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewError) return Response.json({ error: error.message }, { status: error.statusCode });
    return Response.json({ error: "Review could not be saved." }, { status: 500 });
  }
}
