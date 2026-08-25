import Link from "next/link";
import { getStudentDashboard } from "../../../lib/student/get-student-dashboard";

export default async function StudentClassroomsPage() {
  const { classrooms } = await getStudentDashboard();
  return <main className="student-main student-subpage"><header className="student-welcome"><p className="student-kicker">MIS AULAS</p><h1>Elige dónde continuar.</h1><p>Solo aparecen las aulas en las que estás matriculado.</p></header><section className="student-content"><div className="student-classroom-grid">{classrooms.length ? classrooms.map((classroom) => <Link className="student-classroom-card" href={`/student/classrooms/${classroom.id}`} key={classroom.id}><span className="student-label">{classroom.academicPeriod}</span><h2>{classroom.name}</h2><p>{classroom.subject}</p><strong>{classroom.modules.length} módulos publicados</strong><span className="card-arrow">→</span></Link>) : <div className="student-empty"><h2>Todavía no tienes aulas.</h2><p>Cuando tu docente te matricule, aparecerán aquí.</p></div>}</div></section></main>;
}
