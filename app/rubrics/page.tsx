import { requireChatGPTUser } from "../chatgpt-auth";
import RubricStudio from "./RubricStudio";
export const dynamic = "force-dynamic";
export default async function RubricsPage() { const user = await requireChatGPTUser("/rubrics"); return <RubricStudio teacherName={user.displayName} />; }
