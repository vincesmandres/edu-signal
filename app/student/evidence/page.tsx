import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { evidences, learningActivities, learningModules, classrooms } from "../../../db/schema";
import { requireStudent } from "../../../lib/student/require-student";

export default async function StudentEvidencePage() {
  const { student } = await requireStudent("/student/evidence");
  const rows = await getDb().select({ evidence: evidences, activity: learningActivities, module: learningModules, classroom: classrooms }).from(evidences).leftJoin(learningActivities, eq(learningActivities.id, evidences.activityId)).leftJoin(learningModules, eq(learningModules.id, evidences.moduleId)).leftJoin(classrooms, eq(classrooms.id, evidences.classroomId)).where(eq(evidences.studentId, student.id));
  return <main className="student-main student-subpage"><header className="student-welcome"><Link className="back-link" href="/student">← Tu espacio</Link><p className="student-kicker">PORTAFOLIO</p><h1>Mis evidencias</h1></header><section className="student-content">{rows.length ? rows.map(({ evidence, activity, module, classroom }) => <article className="student-next" key={evidence.id}><div><span className="student-label">{evidence.status.toUpperCase()}</span><h3>{evidence.title}</h3><p>{classroom?.name ?? "Registro histórico"} · {module?.title ?? "Sin módulo"} · {activity?.title ?? "Sin actividad"}</p></div><Link className="primary" href={`/student/evidence/${evidence.id}`}>Ver →</Link></article>) : <div className="student-empty"><h3>Todavía no has creado una evidencia.</h3></div>}</section></main>;
}
