import { requireChatGPTUser } from "../chatgpt-auth";
import StudentStudio from "./StudentStudio";

export const dynamic = "force-dynamic";
export default async function StudentsPage() { const user = await requireChatGPTUser("/students"); return <StudentStudio teacherName={user.displayName} />; }
