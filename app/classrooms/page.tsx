import { requireRole } from "../../lib/auth";
import ClassroomStudio from "./ClassroomStudio";

export const dynamic = "force-dynamic";

export default async function ClassroomsPage() {
  const user = await requireRole("teacher", "/classrooms");
  return <ClassroomStudio teacherName={user.displayName} />;
}
