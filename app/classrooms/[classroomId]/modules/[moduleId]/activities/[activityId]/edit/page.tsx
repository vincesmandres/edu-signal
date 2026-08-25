import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { classrooms, learningActivities, learningModules } from "@/db/schema";
import { getTeacherModule } from "@/lib/teacher/get-teacher-module";
import ActivityForm from "../../ActivityForm";

export default async function EditActivityPage({ params }: { params: Promise<{ classroomId: string; moduleId: string; activityId: string }> }) {
  const { moduleId, activityId } = await params;
  await getTeacherModule(moduleId);
  const activity = (await getDb().select({ activity: learningActivities }).from(learningActivities).innerJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).innerJoin(classrooms, eq(classrooms.id, learningModules.classroomId)).where(and(eq(learningActivities.id, activityId), eq(learningActivities.moduleId, moduleId))).limit(1))[0]?.activity;
  if (!activity) notFound();
  const { classroomId } = await params;
  return <ActivityForm classroomId={classroomId} moduleId={moduleId} activity={activity} />;
}
