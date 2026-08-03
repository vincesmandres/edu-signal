"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Classroom = { id: string; name: string; subject: string; academicPeriod: string; status: string };
const approaches = [
  ["ABP", "Aprendizaje Basado en Proyectos", "Reto auténtico, producto público y reflexión."],
  ["ABR", "Aprendizaje Basado en Retos", "Problema del entorno, investigación y acción."],
  ["PhET", "Aprendizaje por simulación", "Explorar, predecir y explicar con simuladores."],
];

export default function ClassroomStudio({ teacherName }: { teacherName: string }) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selected, setSelected] = useState<string[]>(["ABP"]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  useEffect(() => { fetch("/api/classrooms").then((r) => r.ok ? r.json() : { classrooms: [] }).then((data) => setClassrooms(data.classrooms ?? [])); }, []);
  const toggle = (value: string) => setSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  async function createClassroom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, string>;
    const response = await fetch("/api/classrooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, methodologies: selected }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "No se pudo crear el aula."); return; }
    setClassrooms((current) => [data.classroom, ...current]); setOpen(false); event.currentTarget.reset(); setSelected(["ABP"]); setMessage("Aula creada y vinculada a tu perfil docente.");
  }
  return <main className="studio-shell">
    <nav className="studio-nav"><Link href="/" className="brand"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><div><span className="teacher-chip">DOCENTE · {teacherName}</span><button className="signout" onClick={signOut}>Salir</button></div></nav>
    <header className="studio-hero"><p>ESPACIO DOCENTE</p><h1>Diseña aulas que<br/><em>aprenden haciendo.</em></h1><span>Organiza asignaturas, módulos y evaluaciones en un solo lugar. Cada aula se conecta a un docente responsable.</span><button className="primary" onClick={() => setOpen(true)}>+ Crear aula</button></header>
    <section className="method-grid">{approaches.map(([short, title, description]) => <article key={short}><b>{short}</b><h2>{title}</h2><p>{description}</p></article>)}</section>
    <section className="classroom-section"><div className="section-heading"><div><small>AULAS ACTIVAS</small><h2>Mis asignaturas</h2></div><button onClick={() => setOpen(true)}>Nueva aula →</button></div>{classrooms.length ? <div className="classroom-grid">{classrooms.map((room) => <article className="classroom-card" key={room.id}><small>{room.academicPeriod} · ACTIVA</small><h3>{room.name}</h3><p>{room.subject}</p><div><span>Docente responsable</span><strong>{teacherName}</strong></div></article>)}</div> : <div className="empty-state"><b>Tu espacio docente está listo.</b><p>Crea la primera aula para empezar a construir su módulo de aprendizaje y evaluación.</p><button className="soft" onClick={() => setOpen(true)}>Crear mi primera aula →</button></div>}</section>
    {message && <div className="toast">✦ {message}</div>}
    {open && <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal classroom-form" onSubmit={createClassroom}><button type="button" className="close" onClick={() => setOpen(false)} aria-label="Cerrar">×</button><small>NUEVA AULA</small><h2>Construye el punto de partida.</h2><label>Nombre del aula<input name="name" required placeholder="Ej. 2.º B — Ciencias" /></label><label>Asignatura<input name="subject" required placeholder="Ej. Ciencias Naturales" /></label><label>Período académico<input name="academicPeriod" required placeholder="Ej. 2026–2027 · Trimestre 1" /></label><div className="responsible"><span>DOCENTE RESPONSABLE</span><strong>{teacherName}</strong></div><hr/><small>ENFOQUES DEL MÓDULO</small><div className="approach-picker">{approaches.map(([short, title]) => <button type="button" className={selected.includes(short) ? "selected" : ""} onClick={() => toggle(short)} key={short}><b>{short}</b>{title}</button>)}</div><label>Título del módulo<input name="moduleTitle" required placeholder="Ej. Energía para nuestra comunidad" /></label><label>Pregunta que guía el aprendizaje<textarea name="drivingQuestion" required placeholder="¿Cómo podemos…?" /></label><label>Evaluación inicial<input name="assessmentTitle" required placeholder="Ej. Bitácora de investigación" /></label><div className="form-row"><label>Formato<select name="assessmentFormat" defaultValue="Rúbrica"><option>Rúbrica</option><option>Proyecto</option><option>Desempeño</option><option>Portafolio</option></select></label><label>Criterio observable<input name="criteria" required placeholder="Argumenta con evidencia" /></label></div><button className="primary wide" disabled={saving}>{saving ? "Creando…" : "Crear aula y módulo →"}</button></form></div>}
  </main>;
}
