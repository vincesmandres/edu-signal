"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Classroom = { id: string; name: string; subject: string };
type Student = { id: string; displayName: string; email: string | null; classroomId: string };

export default function StudentStudio({ teacherName }: { teacherName: string }) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { Promise.all([fetch("/api/classrooms").then((r) => r.json()), fetch("/api/students").then((r) => r.json())]).then(([rooms, people]) => { setClassrooms(rooms.classrooms ?? []); setStudents(people.students ?? []); }); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const payload = Object.fromEntries(new FormData(event.currentTarget).entries()); const response = await fetch("/api/students", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); setSaving(false); if (!response.ok) { setMessage(data.error ?? "No se pudo guardar el estudiante."); return; } setStudents((current) => [data.student, ...current]); event.currentTarget.reset(); setMessage("Estudiante matriculado correctamente."); }
  return <main className="studio-shell"><nav className="studio-nav"><Link href="/" className="brand"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><div><span className="teacher-chip">DOCENTE · {teacherName}</span><Link className="signout" href="/">Inicio</Link></div></nav><header className="studio-hero compact-hero"><p>GESTIÓN DE ESTUDIANTES</p><h1>Cada trayecto<br/><em>empieza aquí.</em></h1><span>Registra estudiantes y vincúlalos a sus aulas para construir un historial de evidencias y aprendizaje.</span></header><section className="workspace-grid"><form className="modal workspace-form" onSubmit={submit}><small>NUEVO ESTUDIANTE</small><h2>Matricular estudiante</h2><label>Nombre completo<input name="displayName" required placeholder="Ej. Valentina Mora" /></label><label>Correo electrónico<input name="email" type="email" placeholder="opcional" /></label><label>Aula<select name="classroomId" required defaultValue=""><option value="" disabled>Selecciona un aula</option>{classrooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.subject}</option>)}</select></label><button className="primary wide" disabled={saving}>{saving ? "Guardando…" : "Matricular →"}</button>{message && <p className="inline-message">{message}</p>}</form><section className="workspace-list"><div className="section-heading"><div><small>REGISTRO ACTIVO</small><h2>Mis estudiantes</h2></div><strong>{students.length}</strong></div>{students.length ? students.map((student) => <article className="workspace-item" key={student.id}><div className="avatar violet">{student.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div><div><h3>{student.displayName}</h3><p>{student.email ?? "Sin correo registrado"}</p></div><span>ACTIVO</span></article>) : <div className="empty-state"><b>Aún no hay estudiantes.</b><p>Matricula el primero desde este espacio.</p></div>}</section></section></main>;
}
