import { requireRole } from "../../lib/auth";

export default async function AdminPage() {
  await requireRole("admin", "/admin");
  return <main className="auth-shell"><div className="auth-card"><h1>Workspace en construcción</h1></div></main>;
}
