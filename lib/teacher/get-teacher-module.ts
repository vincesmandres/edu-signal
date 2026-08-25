import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../db";
import { classrooms, learningActivities, learningModules } from "../../db/schema";
import { requireRole } from "../auth";

export async function getTeacherModule(moduleId: string, returnTo?: string) {
  const teacher = await requireRole("teacher", returnTo ?? `/classrooms/modules/${moduleId}`);
  const result = (await getDb().select({ module: learningModules, classroom: classrooms }).from(learningModules).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).where(and(eq(learningModules.id, moduleId), eq(classrooms.teacherId, teacher.id))).limit(1))[0];
  if (!result) notFound();
  const activities = await getDb().select().from(learningActivities).where(eq(learningActivities.moduleId, moduleId)).orderBy(learningActivities.position, learningActivities.createdAt);
  return { teacher, ...result, activities };
}
