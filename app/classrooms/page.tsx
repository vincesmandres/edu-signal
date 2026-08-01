import { requireChatGPTUser } from "../chatgpt-auth";
import ClassroomStudio from "./ClassroomStudio";

export const dynamic = "force-dynamic";

export default async function ClassroomsPage() {
  const user = await requireChatGPTUser("/classrooms");
  return <ClassroomStudio teacherName={user.displayName} />;
}
