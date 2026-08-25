import Link from "next/link";
import { getStudentClassroom } from "../../../../lib/student/get-student-classroom";
import { parseMethodologies } from "../../../../lib/student/get-student-module";

export default async function StudentClassroomPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = await params;
  const { classroom, teacherName, modules } = await getStudentClassroom(classroomId);
  return <main className="student-main student-subpage"><header className="student-classroom-header"><Link className="back-link" href="/student/classrooms">← Mis aulas</Link><span className="student-label">{classroom.academicPeriod}</span><h1>{classroom.name}</h1><p>{classroom.subject}</p><span>Docente · {teacherName}</span></header><section className="student-content"><div className="section-heading"><div><small>MÓDULOS</small><h2>Lo que estamos aprendiendo</h2></div><span className="student-count">{modules.length}</span></div>{modules.length ? <div className="student-module-list">{modules.map((module, index) => <article className="student-module-card" key={module.id}><span className="module-number">{String(index + 1).padStart(2, "0")}</span><div><span className="student-label">DISPONIBLE</span><h3>{module.title}</h3><p>{module.drivingQuestion}</p><div className="method-tags">{parseMethodologies(module.methodologies).map((method) => <span key={method}>{method}</span>)}</div></div><Link className="soft" href={`/student/modules/${module.id}`}>Abrir <span>→</span></Link></article>)}</div> : <div className="student-empty"><h3>Todavía no hay módulos publicados en esta aula.</h3><p>Vuelve pronto para continuar tu recorrido.</p></div>}</section></main>;
}
