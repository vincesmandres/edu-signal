import { requireStudent } from "../../lib/student/require-student";
import StudentNav from "./StudentNav";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudent();
  return <div className="student-shell"><StudentNav displayName={profile.displayName} />{children}</div>;
}
