"use client";

import Link from "next/link";
import { useState } from "react";

type Activity = { id: string; title: string; activityType: string; status: string; position: number };
type Module = { id: string; title: string; drivingQuestion: string; phase: string; methodologies: string };

export default function ModuleManager({ module, classroomId, classroomName, activities }: { module: Module; classroomId: string; classroomName: string; activities: Activity[] }) {
  const [current, setCurrent] = useState(module);
  const [title, setTitle] = useState(module.title);
  const [drivingQuestion, setDrivingQuestion] = useState(module.drivingQuestion);
  const [message, setMessage] = useState("");
  async function setPhase(phase: string) {
    const response = await fetch(`/api/modules/${current.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ phase }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo actualizar el módulo."); return; }
    setCurrent(data.module); setMessage(`Módulo ${phase === "published" ? "publicado" : phase === "archived" ? "archivado" : "guardado"}.`);
  }
  async function saveModule(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/modules/${current.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, drivingQuestion }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "No se pudo guardar el módulo."); return; }
    setCurrent(data.module); setMessage("Módulo actualizado.");
  }
  return <main className="studio-shell"><nav className="studio-nav"><Link className="brand" href="/classrooms"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><span className="teacher-chip">DOCENTE · MÓDULO</span></nav><section className="workspace-grid module-manager"><header className="module-manager-header"><Link className="back-link" href="/classrooms">← Aulas</Link><Link className="soft" href={`/classrooms/${classroomId}/grades`}>Libro de calificaciones</Link><small>{classroomName} · {current.phase.toUpperCase()}</small><form onSubmit={saveModule}><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Pregunta guía<textarea value={drivingQuestion} onChange={(event) => setDrivingQuestion(event.target.value)} /></label><button className="soft" type="submit">Guardar módulo</button></form><div className="module-actions"><button className="primary" onClick={() => setPhase(current.phase === "published" ? "draft" : "published")}>{current.phase === "published" ? "Despublicar" : "Publicar módulo"}</button>{current.phase !== "archived" && <button className="soft" onClick={() => setPhase("archived")}>Archivar</button>}</div></header><section className="workspace-list"><div className="section-heading"><div><small>SECUENCIA PEDAGÓGICA</small><h2>Actividades</h2></div><Link className="primary" href={`/classrooms/${classroomId}/modules/${current.id}/activities/new`}>+ Crear actividad</Link></div>{activities.length ? activities.map((activity, index) => <article className="workspace-item" key={activity.id}><span className="module-number">{String(index + 1).padStart(2, "0")}</span><div><h3>{activity.title}</h3><p>{activity.activityType} · {activity.status}</p></div><Link className="section-link" href={`/classrooms/${classroomId}/modules/${current.id}/activities/${activity.id}/edit`}>Editar</Link></article>) : <div className="empty-state"><b>Aún no hay actividades.</b><p>Crea la primera para convertir este módulo en un recorrido.</p></div>}{message && <p className="inline-message" role="status">{message}</p>}</section></section></main>;
}
