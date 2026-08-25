import ModuleManager from "./ModuleManager";
import { getTeacherModule } from "../../../../../lib/teacher/get-teacher-module";

export default async function TeacherModulePage({ params }: { params: Promise<{ classroomId: string; moduleId: string }> }) {
  const { classroomId, moduleId } = await params;
  const data = await getTeacherModule(moduleId, `/classrooms/${classroomId}/modules/${moduleId}`);
  return <ModuleManager module={data.module} classroomId={data.classroom.id} classroomName={data.classroom.name} activities={data.activities} />;
}
