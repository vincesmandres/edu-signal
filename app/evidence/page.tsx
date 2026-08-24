import { requireRole } from "../../lib/auth";
import EvidenceStudio from "./EvidenceStudio";
export const dynamic = "force-dynamic";
export default async function EvidencePage() { const user = await requireRole("teacher", "/evidence"); return <EvidenceStudio teacherName={user.displayName} />; }
