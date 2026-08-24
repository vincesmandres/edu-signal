import { requireRole } from "../../lib/auth";
import StudentStudio from "./StudentStudio";

export const dynamic = "force-dynamic";
export default async function StudentsPage() { const user = await requireRole("teacher", "/students"); return <StudentStudio teacherName={user.displayName} />; }
