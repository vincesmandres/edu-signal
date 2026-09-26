import { requireRole } from "@/lib/auth";
import { requireTeacherClassroom } from "@/lib/authorization";
import { notFound } from "next/navigation";
import Gradebook from "./Gradebook";

export const dynamic = "force-dynamic";

export default async function GradebookPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await requireRole("teacher", "/classrooms"); const { classroomId } = await params;
  const classroom = await requireTeacherClassroom(teacher.id, classroomId); if (!classroom) notFound();
  return <Gradebook classroomId={classroomId} classroomName={classroom.name} initialScale={{ type: classroom.gradeScaleType, min: Number(classroom.gradeScaleMin), max: Number(classroom.gradeScaleMax), passThreshold: Number(classroom.gradePassThreshold) }} />;
}
