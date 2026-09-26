"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { CurriculumDraft } from "@/lib/ai/contracts";

const sections = ["classroom", "module", "activities", "rubric", "resources", "differentiation", "accessibility", "warnings", "assumptions"] as const;
type Section = typeof sections[number];

export default function CurriculumStudio() {
  const [generationId, setGenerationId] = useState("");
  const [draft, setDraft] = useState<CurriculumDraft | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [active, setActive] = useState<Section>("classroom");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState<{ classroomId: string; moduleId: string } | null>(null);
  const [materials, setMaterials] = useState<Array<{ id: string; fileName: string; extractionStatus: string }>>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  useEffect(() => { let active = true; void fetch("/api/teacher/materials").then((response) => response.json()).then((body) => { if (active) setMaterials((body.materials ?? []).filter((item: { extractionStatus: string }) => item.extractionStatus === "completed")); }); return () => { active = false; }; }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("Generando una propuesta completa para revisar…");
    const form = new FormData(event.currentTarget);
    const payload = { topic: form.get("topic"), educationLevel: form.get("educationLevel"), durationMinutes: Number(form.get("durationMinutes")), country: form.get("country") || undefined, framework: form.get("framework") || undefined, methodology: form.get("methodology") || undefined, learningGoals: String(form.get("learningGoals") || "").split("\n").map((item) => item.trim()).filter(Boolean), learnerContext: form.get("learnerContext") || undefined, materialReferences: selectedMaterials };
    const response = await fetch("/api/ai/curriculum/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "No se pudo generar la propuesta."); return; }
    setGenerationId(body.generation.id); setDraft(body.generation.draft); setLocked(body.generation.lockedSections ?? []); setMessage("Propuesta lista. Revisa y edita cada sección antes de aprobar.");
  }
  async function persist(nextDraft = draft, nextLocked = locked) {
    if (!nextDraft) return false;
    setBusy(true);
    const response = await fetch(`/api/ai/curriculum/generations/${generationId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft: nextDraft, lockedSections: nextLocked }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "No se pudieron guardar los cambios."); return false; }
    setDraft(body.generation.draft); setLocked(body.generation.lockedSections); setMessage("Cambios guardados."); return true;
  }
  async function toggleLock(section: Section) {
    const next = locked.includes(section) ? locked.filter((item) => item !== section) : [...locked, section];
    if (await persist(draft, next)) setLocked(next);
  }
  async function regenerate(section: Section) {
    if (!draft || locked.includes(section)) return;
    if (!(await persist())) return;
    setBusy(true); setMessage(`Regenerando ${section}…`);
    const response = await fetch(`/api/ai/curriculum/generations/${generationId}/regenerate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ section }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "No se pudo regenerar la sección."); return; }
    setDraft(body.generation.draft); setMessage("Sección regenerada. Los demás apartados se conservaron.");
  }
  async function approve() {
    if (!(await persist())) return;
    setBusy(true);
    const response = await fetch(`/api/ai/curriculum/generations/${generationId}/approve`, { method: "POST" });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "No se pudo aprobar el borrador."); return; }
    setApproved(body.approved); setMessage("Aula, módulo, actividades y rúbrica creados como borradores.");
  }
  function updateActivity(index: number, changes: Partial<CurriculumDraft["activities"][number]>) {
    if (!draft) return;
    setDraft({ ...draft, activities: draft.activities.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) });
  }

  if (!draft) return <main className="studio-shell"><nav className="studio-nav"><Link href="/classrooms" className="brand"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><span className="teacher-chip">COPILOTO CURRICULAR</span></nav><section className="workspace-grid"><form className="modal workspace-form" onSubmit={generate}><small>NUEVO BORRADOR</small><h1>Parte de una intención, no de una plantilla.</h1><label>Tema<input name="topic" required maxLength={500} placeholder="Ej. Energía y justicia ambiental" /></label><label>Nivel educativo<input name="educationLevel" required maxLength={500} placeholder="Ej. 9.º grado" /></label><label>Duración total en minutos<input name="durationMinutes" type="number" min="30" max="20000" required defaultValue="240" /></label><div className="form-row"><label>País<input name="country" /></label><label>Marco o estándares<input name="framework" /></label></div><label>Metodología<input name="methodology" placeholder="ABP, indagación…" /></label><label>Objetivos propios, uno por línea<textarea name="learningGoals" /></label><label>Contexto del grupo, sin nombres ni datos personales<textarea name="learnerContext" /></label>{materials.length > 0 && <fieldset><legend>Materiales privados ya extraídos</legend>{materials.map((material) => <label className="checkbox-label" key={material.id}><input type="checkbox" checked={selectedMaterials.includes(material.id)} onChange={() => setSelectedMaterials((current) => current.includes(material.id) ? current.filter((id) => id !== material.id) : [...current, material.id])} /> {material.fileName}</label>)}</fieldset>}<button className="primary wide" disabled={busy}>{busy ? "Generando…" : "Generar borrador editable →"}</button>{message && <p className="inline-message" role="status">{message}</p>}</form></section></main>;

  return <main className="studio-shell">
    <nav className="studio-nav"><Link href="/classrooms" className="brand"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><span className="teacher-chip">BORRADOR · NO PUBLICADO</span></nav>
    <header className="studio-hero"><p>REVISIÓN DOCENTE OBLIGATORIA</p><h1>{draft.classroom.title}</h1><span>{draft.module.drivingQuestion}</span></header>
    <section className="workspace-grid">
      <aside className="workspace-list">{sections.map((section) => <button type="button" key={section} className={active === section ? "selected" : ""} onClick={() => setActive(section)}>{section} {locked.includes(section) ? "· bloqueado" : ""}</button>)}</aside>
      <section className="modal workspace-form">
        <div className="activity-actions"><button type="button" className="soft" disabled={busy} onClick={() => void toggleLock(active)}>{locked.includes(active) ? "Desbloquear" : "Bloquear sección"}</button><button type="button" className="soft" disabled={busy || locked.includes(active)} onClick={() => void regenerate(active)}>Regenerar sección</button></div>
        {active === "classroom" && <>
          <label>Título del aula<input value={draft.classroom.title} onChange={(event) => setDraft({ ...draft, classroom: { ...draft.classroom, title: event.target.value } })} /></label>
          <label>Asignatura<input value={draft.classroom.subject} onChange={(event) => setDraft({ ...draft, classroom: { ...draft.classroom, subject: event.target.value } })} /></label>
          <label>Período<input value={draft.classroom.academicPeriod} onChange={(event) => setDraft({ ...draft, classroom: { ...draft.classroom, academicPeriod: event.target.value } })} /></label>
        </>}
        {active === "module" && <>
          <label>Título del módulo<input value={draft.module.title} onChange={(event) => setDraft({ ...draft, module: { ...draft.module, title: event.target.value } })} /></label>
          <label>Pregunta guía<textarea value={draft.module.drivingQuestion} onChange={(event) => setDraft({ ...draft, module: { ...draft.module, drivingQuestion: event.target.value } })} /></label>
          <label>Justificación<textarea value={draft.module.rationale} onChange={(event) => setDraft({ ...draft, module: { ...draft.module, rationale: event.target.value } })} /></label>
          <h3>Objetivos</h3>{draft.module.objectives.map((objective, index) => <input key={index} value={objective} onChange={(event) => setDraft({ ...draft, module: { ...draft.module, objectives: draft.module.objectives.map((item, itemIndex) => itemIndex === index ? event.target.value : item) } })} />)}
        </>}
        {active === "activities" && draft.activities.map((activity, index) => <article className="student-activity-card" key={activity.id}><small>{activity.checkpoint.toUpperCase()} · {activity.estimatedMinutes} MIN</small><label>Título<input value={activity.title} onChange={(event) => updateActivity(index, { title: event.target.value })} /></label><label>Instrucciones<textarea value={activity.instructions} onChange={(event) => updateActivity(index, { instructions: event.target.value })} /></label><label>Objetivo del ciclo<textarea value={activity.config.objective} onChange={(event) => updateActivity(index, { config: { ...activity.config, objective: event.target.value } })} /></label></article>)}
        {active === "rubric" && <><label>Título<input value={draft.rubric.title} onChange={(event) => setDraft({ ...draft, rubric: { ...draft.rubric, title: event.target.value } })} /></label>{draft.rubric.criteria.map((criterion, index) => <fieldset key={criterion.id}><legend>Criterio {index + 1}</legend><input value={criterion.name} onChange={(event) => setDraft({ ...draft, rubric: { ...draft.rubric, criteria: draft.rubric.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) } })} /><textarea value={criterion.description} onChange={(event) => setDraft({ ...draft, rubric: { ...draft.rubric, criteria: draft.rubric.criteria.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) } })} /></fieldset>)}</>}
        {active === "resources" && draft.resources.map((resource) => <article key={resource.id} className="student-activity-card"><b>{resource.title}</b><p>{resource.suggestion}</p><small>{resource.verificationState === "verified" ? "VERIFICADO" : "SUGERENCIA SIN ENLACE"}</small>{resource.url && <a href={resource.url} target="_blank" rel="noreferrer">Abrir recurso</a>}</article>)}
        {(["differentiation", "accessibility", "warnings", "assumptions"] as Section[]).includes(active) && <ul>{(draft[active] as string[]).map((item) => <li key={item}>{item}</li>)}</ul>}
        <div className="activity-actions"><button type="button" className="soft" disabled={busy} onClick={() => void persist()}>Guardar cambios</button><button type="button" className="primary" disabled={busy} onClick={() => void approve()}>Aprobar y crear borradores →</button></div>
        {message && <p className="inline-message" role="status">{message}</p>}{approved && <Link className="primary" href={`/classrooms/${approved.classroomId}/modules/${approved.moduleId}`}>Abrir módulo creado →</Link>}
      </section>
    </section>
  </main>;
}
