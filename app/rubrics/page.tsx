import { requireRole } from "../../lib/auth";
import RubricStudio from "./RubricStudio";
export const dynamic = "force-dynamic";
export default async function RubricsPage() { const user = await requireRole("teacher", "/rubrics"); return <RubricStudio teacherName={user.displayName} />; }
