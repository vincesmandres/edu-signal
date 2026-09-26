import { requireStudent } from "@/lib/student/require-student";
import StudentNav from "../StudentNav";
import GradesView from "./GradesView";

export const dynamic = "force-dynamic";

export default async function StudentGradesPage() {
  const { student } = await requireStudent("/student/grades");
  return <main className="student-main"><StudentNav displayName={student.displayName} /><section className="student-content"><span className="student-label">CALIFICACIONES PUBLICADAS</span><h1>Tu progreso oficial</h1><p>Las sugerencias de IA y los borradores docentes nunca aparecen aquí.</p><GradesView /></section></main>;
}
