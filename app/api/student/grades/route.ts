import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { classrooms, grades, learningActivities, learningModules, teacherReviewCriteria, teacherReviews } from "@/db/schema";
import { requireStudent } from "@/lib/student/require-student";

export async function GET() {
  const { student } = await requireStudent();
  const rows = await getDb().select({ grade: grades, classroomName: classrooms.name, activityTitle: learningActivities.title, review: { publicFeedback: teacherReviews.publicFeedback, requiredImprovements: teacherReviews.requiredImprovements }, criterion: teacherReviewCriteria })
    .from(grades).innerJoin(classrooms, eq(classrooms.id, grades.classroomId)).leftJoin(learningActivities, and(eq(grades.targetType, "activity"), eq(learningActivities.id, grades.targetId))).leftJoin(learningModules, eq(learningModules.id, learningActivities.moduleId)).leftJoin(teacherReviews, eq(teacherReviews.id, grades.sourceReviewId)).leftJoin(teacherReviewCriteria, eq(teacherReviewCriteria.reviewId, teacherReviews.id))
    .where(and(eq(grades.studentId, student.id), eq(grades.status, "published"), eq(teacherReviews.status, "published"))).orderBy(desc(grades.publishedAt));
  const grouped = new Map<string, { grade: typeof grades.$inferSelect; classroomName: string; activityTitle: string | null; review: { publicFeedback: string | null; requiredImprovements: unknown } | null; criteria: Array<typeof teacherReviewCriteria.$inferSelect> }>();
  for (const row of rows) { const current = grouped.get(row.grade.id) ?? { grade: row.grade, classroomName: row.classroomName, activityTitle: row.activityTitle, review: row.review, criteria: [] }; if (row.criterion) current.criteria.push(row.criterion); grouped.set(row.grade.id, current); }
  return Response.json({ grades: [...grouped.values()] }, { headers: { "cache-control": "no-store" } });
}
