import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { classrooms, enrollments, learningActivities, learningModules, profiles, studentActivityProgress, students } from "../../db/schema";
import { requireStudent } from "./require-student";

export async function getStudentDashboard() {
  const context = await requireStudent();
  const rows = await getDb().select({
    classroom: classrooms,
    teacherName: profiles.displayName,
    module: learningModules,
  }).from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(classrooms, eq(classrooms.id, enrollments.classroomId))
    .innerJoin(profiles, eq(profiles.id, classrooms.teacherId))
    .leftJoin(learningModules, and(eq(learningModules.classroomId, classrooms.id), eq(learningModules.phase, "published")))
    .where(and(eq(students.id, context.student.id), eq(enrollments.status, "active"), eq(classrooms.status, "active")))
    .orderBy(desc(classrooms.createdAt), asc(learningModules.createdAt));

  type PublishedModule = NonNullable<typeof rows[number]["module"]>;
  const classroomsById = new Map<string, { id: string; name: string; subject: string; academicPeriod: string; teacherName: string; modules: PublishedModule[] }>();
  for (const row of rows) {
    const current = classroomsById.get(row.classroom.id) ?? { id: row.classroom.id, name: row.classroom.name, subject: row.classroom.subject, academicPeriod: row.classroom.academicPeriod, teacherName: row.teacherName, modules: [] };
    if (row.module && !current.modules.some((module) => module.id === row.module!.id)) current.modules.push(row.module);
    classroomsById.set(row.classroom.id, current);
  }
  const classroomList = [...classroomsById.values()];
  const moduleIds = classroomList.flatMap((classroom) => classroom.modules.map((module) => module.id));
  const activityRows = moduleIds.length ? await getDb().select({ activity: learningActivities, progress: studentActivityProgress }).from(learningActivities).leftJoin(studentActivityProgress, and(eq(studentActivityProgress.activityId, learningActivities.id), eq(studentActivityProgress.studentId, context.student.id))).where(and(inArray(learningActivities.moduleId, moduleIds), eq(learningActivities.status, "published"))).orderBy(asc(learningActivities.position)) : [];
  const activitiesByModule = new Map<string, typeof activityRows>();
  for (const row of activityRows) activitiesByModule.set(row.activity.moduleId, [...(activitiesByModule.get(row.activity.moduleId) ?? []), row]);
  return {
    ...context,
    classrooms: classroomList,
    modules: classroomList.flatMap((classroom) => classroom.modules.map((module) => { const activities = activitiesByModule.get(module.id) ?? []; const required = activities.filter(({ activity }) => activity.required); const completed = required.filter(({ progress }) => progress?.status === "completed").length; return { module, classroom, activities, nextActivity: activities.find(({ progress }) => progress?.status !== "completed")?.activity, progress: { completed, total: required.length } }; })),
  };
}
