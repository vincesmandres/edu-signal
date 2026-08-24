import { requireRole } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const profile = await requireRole("student", "/student");
  return <main className="auth-shell"><div className="auth-card"><small>EDU SIGNAL</small><h1>Hola, {profile.displayName}.</h1><p>Tu espacio de aprendizaje está listo.</p><div className="workspace-list"><h2>Mis aulas</h2><p>Próximamente</p></div></div></main>;
}
