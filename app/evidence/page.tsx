import { requireChatGPTUser } from "../chatgpt-auth";
import EvidenceStudio from "./EvidenceStudio";
export const dynamic = "force-dynamic";
export default async function EvidencePage() { const user = await requireChatGPTUser("/evidence"); return <EvidenceStudio teacherName={user.displayName} />; }
