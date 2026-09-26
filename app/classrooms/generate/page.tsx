import { requireRole } from "@/lib/auth";
import CurriculumStudio from "./CurriculumStudio";

export const dynamic = "force-dynamic";

export default async function GenerateClassroomPage() {
  await requireRole("teacher", "/classrooms/generate");
  if (process.env.AI_CURRICULUM_ENABLED !== "true") return <main className="studio-shell"><section className="empty-state"><h1>Generación no disponible</h1><p>La función está desactivada para este entorno.</p></section></main>;
  return <CurriculumStudio />;
}
