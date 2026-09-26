import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { activityRubrics, classrooms, enrollments, learningActivities, learningModules, rubricCriteria, rubrics } from "@/db/schema";
import { inquiryCycleConfigSchema } from "@/lib/ai/contracts";

export async function getStudentInquiryContext(studentId: string, activityId: string) {
  const row = (await getDb().select({ activity: learningActivities, classroom: classrooms }).from(learningActivities)
    .innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId))
    .innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId))
    .innerJoin(enrollments, and(eq(enrollments.classroomId, classrooms.id), eq(enrollments.studentId, studentId), eq(enrollments.status, "active")))
    .where(and(eq(learningActivities.id, activityId), eq(learningActivities.activityType, "inquiry_cycle"), eq(learningActivities.status, "published"), eq(learningModules.phase, "published"))).limit(1))[0];
  if (!row) return null;
  const config = inquiryCycleConfigSchema.safeParse(row.activity.config);
  if (!config.success) return null;
  const criteria = await getDb().select({ id: rubricCriteria.id, name: rubricCriteria.name, description: rubricCriteria.description, maxScore: rubricCriteria.maxScore })
    .from(activityRubrics).innerJoin(rubrics, eq(rubrics.id, activityRubrics.rubricId)).innerJoin(rubricCriteria, eq(rubricCriteria.rubricId, rubrics.id))
    .where(eq(activityRubrics.activityId, activityId));
  return { ...row, config: config.data, criteria };
}

const orderedFields = ["prediction", "interpretations", "evidenceContrast", "alternativeCritique", "revisedSynthesis", "changeFromPrediction", "aiUse"];

export function validatesDraftStageOrder(value: Record<string, unknown>) {
  let foundGap = false;
  for (const field of orderedFields) {
    const present = value[field] !== undefined;
    if (!present) foundGap = true;
    else if (foundGap) return false;
  }
  return true;
}
