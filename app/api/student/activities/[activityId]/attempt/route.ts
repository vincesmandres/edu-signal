import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { activityAttempts, activityResponseVersions, formativeFeedback, selfAssessmentCriteria, selfAssessments, teacherReviews } from "@/db/schema";
import { inquiryResponseDraftSchema, selfAssessmentSchema } from "@/lib/ai/contracts";
import { getStudentInquiryContext, validatesDraftStageOrder } from "@/lib/inquiry";
import { requireStudent } from "@/lib/student/require-student";

async function getAttempt(studentId: string, activityId: string) {
  const attempt = (await getDb().select().from(activityAttempts).where(and(eq(activityAttempts.studentId, studentId), eq(activityAttempts.activityId, activityId))).limit(1))[0];
  if (!attempt) return null;
  const version = (await getDb().select().from(activityResponseVersions).where(and(eq(activityResponseVersions.attemptId, attempt.id), eq(activityResponseVersions.revision, attempt.currentRevision))).limit(1))[0] ?? null;
  const self = version ? (await getDb().select().from(selfAssessments).where(eq(selfAssessments.responseVersionId, version.id)).limit(1))[0] ?? null : null;
  const criteria = self ? await getDb().select().from(selfAssessmentCriteria).where(eq(selfAssessmentCriteria.selfAssessmentId, self.id)) : [];
  const feedback = version ? (await getDb().select({ id: formativeFeedback.id, status: formativeFeedback.status, feedback: formativeFeedback.feedback, source: formativeFeedback.source, createdAt: formativeFeedback.createdAt }).from(formativeFeedback).where(eq(formativeFeedback.responseVersionId, version.id)).limit(1))[0] ?? null : null;
  const history = await getDb().select({ id: activityResponseVersions.id, revision: activityResponseVersions.revision, stageResponses: activityResponseVersions.stageResponses, submittedAt: activityResponseVersions.submittedAt, reviewStatus: teacherReviews.status, publicFeedback: teacherReviews.publicFeedback, requiredImprovements: teacherReviews.requiredImprovements })
    .from(activityResponseVersions).leftJoin(teacherReviews, and(eq(teacherReviews.responseVersionId, activityResponseVersions.id), inArray(teacherReviews.status, ["returned", "published"]))).where(and(eq(activityResponseVersions.attemptId, attempt.id), eq(activityResponseVersions.status, "submitted")));
  return { attempt, version, selfAssessment: self ? { ...self, criteria } : null, formativeFeedback: feedback, history };
}

export async function GET(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  const activity = await getStudentInquiryContext(student.id, activityId);
  if (!activity) return Response.json({ error: "Inquiry activity not found." }, { status: 404 });
  return Response.json({ data: await getAttempt(student.id, activityId), rubric: activity.criteria }, { headers: { "cache-control": "no-store" } });
}

export async function POST(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  if (process.env.DEEP_LEARNING_LOOP_ENABLED !== "true") return Response.json({ error: "Deep learning loop is disabled." }, { status: 503 });
  const activity = await getStudentInquiryContext(student.id, activityId);
  if (!activity) return Response.json({ error: "Inquiry activity not found." }, { status: 404 });
  const attemptId = crypto.randomUUID();
  const created = (await getDb().insert(activityAttempts).values({ id: attemptId, studentId: student.id, activityId, status: "draft", currentRevision: 0, revisionLimit: activity.config.maximumRevisions }).onConflictDoNothing({ target: [activityAttempts.studentId, activityAttempts.activityId] }).returning())[0];
  const attempt = created ?? (await getDb().select().from(activityAttempts).where(and(eq(activityAttempts.studentId, student.id), eq(activityAttempts.activityId, activityId))).limit(1))[0];
  if (!attempt) return Response.json({ error: "Could not start inquiry." }, { status: 500 });
  await getDb().insert(activityResponseVersions).values({ id: crypto.randomUUID(), attemptId: attempt.id, revision: attempt.currentRevision, status: "draft" }).onConflictDoNothing({ target: [activityResponseVersions.attemptId, activityResponseVersions.revision] });
  return Response.json({ data: await getAttempt(student.id, activityId), rubric: activity.criteria }, { status: created ? 201 : 200, headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { student } = await requireStudent();
  const { activityId } = await context.params;
  const activity = await getStudentInquiryContext(student.id, activityId);
  if (!activity) return Response.json({ error: "Inquiry activity not found." }, { status: 404 });
  let body: { response?: unknown; selfAssessment?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const response = inquiryResponseDraftSchema.safeParse(body.response);
  if (!response.success || !validatesDraftStageOrder(response.data)) return Response.json({ error: "Stages must be completed in order." }, { status: 422 });
  const assessment = body.selfAssessment === undefined ? null : selfAssessmentSchema.safeParse(body.selfAssessment);
  if (assessment && !assessment.success) return Response.json({ error: "Self-assessment is invalid." }, { status: 422 });
  try {
    await getDb().transaction(async (tx) => {
      const attempt = (await tx.select().from(activityAttempts).where(and(eq(activityAttempts.studentId, student.id), eq(activityAttempts.activityId, activityId))).for("update").limit(1))[0];
      if (!attempt || !["draft", "returned"].includes(attempt.status)) throw new Error("not_editable");
      const version = (await tx.select().from(activityResponseVersions).where(and(eq(activityResponseVersions.attemptId, attempt.id), eq(activityResponseVersions.revision, attempt.currentRevision), eq(activityResponseVersions.status, "draft"))).for("update").limit(1))[0];
      if (!version) throw new Error("not_editable");
      const existing = version.stageResponses as Record<string, unknown>;
      if (existing.prediction !== undefined && JSON.stringify(existing.prediction) !== JSON.stringify(response.data.prediction)) throw new Error("prediction_committed");
      await tx.update(activityResponseVersions).set({ stageResponses: response.data, aiUseDeclaration: response.data.aiUse ?? { used: false }, updatedAt: new Date().toISOString() }).where(eq(activityResponseVersions.id, version.id));
      if (assessment?.success) {
        const selfId = crypto.randomUUID();
        const saved = (await tx.insert(selfAssessments).values({ id: selfId, responseVersionId: version.id, confidence: assessment.data.confidence, rationale: assessment.data.rationale }).onConflictDoUpdate({ target: selfAssessments.responseVersionId, set: { confidence: assessment.data.confidence, rationale: assessment.data.rationale, updatedAt: new Date().toISOString() } }).returning())[0];
        await tx.delete(selfAssessmentCriteria).where(eq(selfAssessmentCriteria.selfAssessmentId, saved.id));
        await tx.insert(selfAssessmentCriteria).values(assessment.data.criteria.map((criterion) => ({ id: crypto.randomUUID(), selfAssessmentId: saved.id, criterionId: criterion.criterionId, score: String(criterion.score), rationale: criterion.rationale })));
      }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "not_editable";
    return Response.json({ error: code === "prediction_committed" ? "The initial prediction is committed and cannot be changed." : "This revision is not editable." }, { status: 409 });
  }
  return Response.json({ data: await getAttempt(student.id, activityId), rubric: activity.criteria }, { headers: { "cache-control": "no-store" } });
}
