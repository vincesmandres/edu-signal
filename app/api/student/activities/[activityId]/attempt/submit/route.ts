import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityAttempts, activityResponseVersions, auditEvents, evidences, formativeFeedback, selfAssessmentCriteria, selfAssessments, studentActivityProgress } from "@/db/schema";
import { inquiryResponseSchema, selfAssessmentSchema } from "@/lib/ai/contracts";
import { generateFormativeFeedback } from "@/lib/ai/feedback";
import { AiProviderError } from "@/lib/ai/provider";
import { AiQuotaError, assertAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { getStudentInquiryContext } from "@/lib/inquiry";
import { requireStudent } from "@/lib/student/require-student";

class SubmitError extends Error {}

export async function POST(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const { profile, student } = await requireStudent();
  const { activityId } = await context.params;
  const activity = await getStudentInquiryContext(student.id, activityId);
  if (!activity) return Response.json({ error: "Inquiry activity not found." }, { status: 404 });
  let submitted: { versionId: string; response: ReturnType<typeof inquiryResponseSchema.parse> };
  try {
    submitted = await getDb().transaction(async (tx) => {
      const attempt = (await tx.select().from(activityAttempts).where(and(eq(activityAttempts.studentId, student.id), eq(activityAttempts.activityId, activityId))).for("update").limit(1))[0];
      if (!attempt || !["draft", "returned"].includes(attempt.status)) throw new SubmitError("This attempt cannot be submitted.");
      const version = (await tx.select().from(activityResponseVersions).where(and(eq(activityResponseVersions.attemptId, attempt.id), eq(activityResponseVersions.revision, attempt.currentRevision), eq(activityResponseVersions.status, "draft"))).for("update").limit(1))[0];
      if (!version) throw new SubmitError("Draft response not found.");
      const response = inquiryResponseSchema.safeParse(version.stageResponses);
      if (!response.success) throw new SubmitError("Complete every inquiry stage before submitting.");
      const self = (await tx.select().from(selfAssessments).where(eq(selfAssessments.responseVersionId, version.id)).for("update").limit(1))[0];
      if (!self) throw new SubmitError("Complete the rubric self-assessment before submitting.");
      const criterionRows = await tx.select().from(selfAssessmentCriteria).where(eq(selfAssessmentCriteria.selfAssessmentId, self.id));
      const assessment = selfAssessmentSchema.safeParse({ confidence: self.confidence, rationale: self.rationale, criteria: criterionRows.map((row) => ({ criterionId: row.criterionId, score: Number(row.score), rationale: row.rationale })) });
      const expectedIds = new Set(activity.criteria.map((criterion) => criterion.id));
      if (!assessment.success || criterionRows.length !== expectedIds.size || criterionRows.some((row) => !expectedIds.has(row.criterionId))) throw new SubmitError("Self-assess every rubric criterion before submitting.");
      let evidenceId: string | null = null;
      if (activity.activity.requiresEvidence) {
        const evidence = (await tx.select({ id: evidences.id }).from(evidences).where(and(eq(evidences.activityId, activityId), eq(evidences.studentId, student.id), eq(evidences.status, "submitted"))).limit(1))[0];
        if (!evidence) throw new SubmitError("Submit the required evidence before this inquiry.");
        evidenceId = evidence.id;
      }
      const now = new Date().toISOString();
      await tx.update(activityResponseVersions).set({ status: "submitted", evidenceId, submittedAt: now, updatedAt: now }).where(eq(activityResponseVersions.id, version.id));
      await tx.update(activityAttempts).set({ status: "submitted", submittedAt: now, updatedAt: now }).where(eq(activityAttempts.id, attempt.id));
      await tx.insert(formativeFeedback).values({ id: crypto.randomUUID(), responseVersionId: version.id, status: "pending", source: "ai" });
      await tx.insert(studentActivityProgress).values({ id: crypto.randomUUID(), studentId: student.id, activityId, status: "completed", startedAt: attempt.createdAt, completedAt: now }).onConflictDoUpdate({ target: [studentActivityProgress.studentId, studentActivityProgress.activityId], set: { status: "completed", completedAt: now, updatedAt: now } });
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: profile.id, action: "inquiry.submitted", entityType: "activity_response_version", entityId: version.id, metadata: JSON.stringify({ activityId, revision: version.revision }) });
      return { versionId: version.id, response: response.data };
    });
  } catch (error) {
    if (error instanceof SubmitError) return Response.json({ error: error.message }, { status: 422 });
    return Response.json({ error: "Inquiry submission failed." }, { status: 500 });
  }

  if (process.env.DEEP_LEARNING_LOOP_ENABLED === "true") {
    try {
      await assertAiQuota(profile.id, "feedback", "student");
      const result = await generateFormativeFeedback({ studentId: student.id, studentName: student.displayName, config: activity.config, response: submitted.response, rubric: activity.criteria });
      const { proposedScores, ...publicFeedback } = result.data;
      await getDb().update(formativeFeedback).set({ status: "completed", feedback: publicFeedback, proposedScores, model: result.model, promptVersion: result.promptVersion, usage: result.usage, updatedAt: new Date().toISOString() }).where(eq(formativeFeedback.responseVersionId, submitted.versionId));
      await recordAiUsage(profile.id, "feedback", result.usage);
    } catch (error) {
      const code = error instanceof AiQuotaError ? "rate_limited" : error instanceof AiProviderError ? error.code : "provider";
      await getDb().update(formativeFeedback).set({ status: "failed", errorCode: code, updatedAt: new Date().toISOString() }).where(eq(formativeFeedback.responseVersionId, submitted.versionId));
    }
  }
  return Response.json({ submitted: true, versionId: submitted.versionId }, { status: 201, headers: { "cache-control": "no-store" } });
}
