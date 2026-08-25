import ActivityForm from "../ActivityForm";
import { getTeacherModule } from "@/lib/teacher/get-teacher-module";

export default async function NewActivityPage({ params }: { params: Promise<{ classroomId: string; moduleId: string }> }) {
  const { moduleId } = await params;
  await getTeacherModule(moduleId);
  const { classroomId } = await params;
  return <ActivityForm classroomId={classroomId} moduleId={moduleId} />;
}
