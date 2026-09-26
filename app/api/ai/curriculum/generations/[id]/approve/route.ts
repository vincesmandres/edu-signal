import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityRubrics, assessments, auditEvents, classrooms, curriculumGenerations, learningActivities, learningModules, rubricCriteria, rubrics } from "@/db/schema";
import { getApiProfile } from "@/lib/auth";
import { curriculumDraftSchema, generationInputSchema } from "@/lib/ai/contracts";
import { validateDraftDuration } from "@/lib/ai/curriculum";

class ApprovalError extends Error {}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  const { id } = await context.params;
  let approved: { classroomId: string; moduleId: string };
  try {
    approved = await getDb().transaction(async (tx) => {
      const generation = (await tx.select().from(curriculumGenerations).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.teacherId, auth.profile!.id))).for("update").limit(1))[0];
      if (!generation) throw new ApprovalError("Generation not found.");
      if (generation.status !== "completed") throw new ApprovalError("Generation is not ready for approval.");
      const draft = curriculumDraftSchema.safeParse(generation.draft);
      const input = generationInputSchema.safeParse(generation.sanitizedInput);
      if (!draft.success || !input.success || !validateDraftDuration(draft.success ? draft.data : null as never, input.success ? input.data.durationMinutes : 0)) throw new ApprovalError("Stored curriculum failed validation.");
      const classroomId = crypto.randomUUID();
      const moduleId = crypto.randomUUID();
      const rubricId = crypto.randomUUID();
      await tx.insert(classrooms).values({
        id: classroomId,
        name: draft.data.classroom.title,
        subject: draft.data.classroom.subject,
        academicPeriod: draft.data.classroom.academicPeriod,
        teacherId: auth.profile!.id,
        status: "active",
        country: input.data.country || null,
        standardsFramework: input.data.framework || null,
        educationLevel: input.data.educationLevel,
      });
      await tx.insert(learningModules).values({ id: moduleId, classroomId, title: draft.data.module.title, drivingQuestion: draft.data.module.drivingQuestion, methodologies: JSON.stringify(input.data.methodology ? [input.data.methodology] : []), phase: "draft" });
      await tx.insert(rubrics).values({ id: rubricId, classroomId, title: draft.data.rubric.title, description: draft.data.rubric.description, status: "draft" });
      const criterionIds = new Map<string, string>();
      await tx.insert(rubricCriteria).values(draft.data.rubric.criteria.map((criterion, index) => {
        const criterionId = crypto.randomUUID();
        criterionIds.set(criterion.id, criterionId);
        return { id: criterionId, rubricId, name: criterion.name, description: `${criterion.description}\n${criterion.descriptors.map((descriptor) => `${descriptor.level}: ${descriptor.description}`).join("\n")}`, maxScore: String(criterion.maxScore), position: String(index + 1) };
      }));
      for (const activity of draft.data.activities) {
        const activityId = crypto.randomUUID();
        await tx.insert(learningActivities).values({ id: activityId, moduleId, title: activity.title, instructions: activity.instructions, activityType: "inquiry_cycle", position: activity.position, required: true, requiresEvidence: activity.requiresEvidence, config: activity.config, status: "draft" });
        await tx.insert(activityRubrics).values({ id: crypto.randomUUID(), activityId, rubricId });
        await tx.insert(assessments).values({ id: crypto.randomUUID(), moduleId, title: `${activity.checkpoint}: ${activity.title}`, format: activity.checkpoint, criteria: JSON.stringify(activity.rubricCriterionIds.map((criterionId) => criterionIds.get(criterionId))) });
      }
      const now = new Date().toISOString();
      const changed = await tx.update(curriculumGenerations).set({ status: "approved", approvedClassroomId: classroomId, approvedAt: now, updatedAt: now }).where(and(eq(curriculumGenerations.id, id), eq(curriculumGenerations.status, "completed"))).returning({ id: curriculumGenerations.id });
      if (!changed.length) throw new ApprovalError("Generation changed concurrently.");
      await tx.insert(auditEvents).values({ id: crypto.randomUUID(), actorId: auth.profile!.id, action: "curriculum_generation.approved", entityType: "curriculum_generation", entityId: id, metadata: JSON.stringify({ classroomId, moduleId }) });
      return { classroomId, moduleId };
    });
  } catch (error) {
    if (error instanceof ApprovalError) return Response.json({ error: error.message }, { status: error.message.includes("not found") ? 404 : 409 });
    return Response.json({ error: "Curriculum approval failed atomically." }, { status: 500 });
  }
  return Response.json({ approved }, { status: 201, headers: { "cache-control": "no-store" } });
}
