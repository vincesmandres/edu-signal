"use client";

import { FormEvent, useEffect, useState } from "react";
import InquiryCycleRenderer from "./InquiryCycleRenderer";

type Activity = { id: string; title: string; instructions: string; activityType: string; config: unknown };
type Evidence = { id: string; title: string; description?: string | null; fileName?: string | null; evidenceType: string; status: string; textContent?: string | null; externalUrl?: string | null } | null;

type ActivityRendererProps = { activity: Activity & { requiresEvidence?: boolean }; initialResponse: string; completed: boolean; initialEvidence?: Evidence };

export default function ActivityRenderer(props: ActivityRendererProps) {
  if (props.activity.activityType === "inquiry_cycle") return <><InquiryCycleRenderer activity={props.activity} />{props.activity.requiresEvidence && <EvidenceComposer activityId={props.activity.id} initialEvidence={props.initialEvidence} onChange={() => undefined} />}</>;
  return <LegacyActivityRenderer {...props} />;
}

function LegacyActivityRenderer({ activity, initialResponse, completed, initialEvidence }: ActivityRendererProps) {
  const [response, setResponse] = useState(initialResponse);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [isCompleted, setIsCompleted] = useState(completed);
  const config = activity.config as Record<string, unknown>;
  useEffect(() => { if (!isCompleted) void fetch(`/api/student/activities/${activity.id}/start`, { method: "POST" }); }, [activity.id, isCompleted]);
  async function saveResponse() {
    setSaving(true); setMessage("");
    const result = await fetch(`/api/student/activities/${activity.id}/response`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) });
    const data = await result.json().catch(() => ({}));
    if (!result.ok || data.success !== true) { setMessage(data.error ?? "No se pudo guardar la respuesta."); setSaving(false); return false; }
    setMessage("Respuesta guardada."); setSaving(false); return true;
  }
  async function save(event: FormEvent) { event.preventDefault(); return saveResponse(); }
  async function complete() {
    setSaving(true); setMessage("");
    const result = await fetch(`/api/student/activities/${activity.id}/complete`, { method: "POST" });
    const data = await result.json().catch(() => ({}));
    if (result.ok) setIsCompleted(true);
    setMessage(result.ok ? "Actividad completada." : data.error ?? "No se pudo completar."); setSaving(false);
  }
  const evidenceBlocked = activity.requiresEvidence && evidence?.status !== "submitted";
  const blockedHelpId = `evidence-blocked-${activity.id}`;
  return <section className="activity-interaction"><span className="student-label">{activity.activityType.toUpperCase()}</span><h2>{activity.title}</h2>{activity.instructions && <p className="activity-instructions">{activity.instructions}</p>}{evidenceBlocked && <p id={blockedHelpId} role="status">Envía una evidencia antes de completar esta actividad.</p>}{["instruction", "reading"].includes(activity.activityType) && <><p className="activity-content">{String(config.content ?? "")}</p><button className="primary" aria-describedby={evidenceBlocked ? blockedHelpId : undefined} disabled={saving || isCompleted || evidenceBlocked} onClick={complete}>{isCompleted ? "Completada" : "Marcar como completada"}</button></>}{["question", "prediction", "reflection"].includes(activity.activityType) && <form onSubmit={save}><label>{String(config.prompt ?? "¿Qué piensas?")}<textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={7} placeholder="Escribe tu respuesta..." /></label><div className="activity-actions"><button className="soft" disabled={saving || !response.trim()}>{saving ? "Guardando…" : "Guardar respuesta"}</button><button type="button" className="primary" aria-describedby={evidenceBlocked ? blockedHelpId : undefined} disabled={saving || !response.trim() || isCompleted || evidenceBlocked} onClick={async () => { const saved = await saveResponse(); if (saved) await complete(); }}>{isCompleted ? "Completada" : "Marcar como completada"}</button></div></form>}{activity.requiresEvidence && <EvidenceComposer initialEvidence={evidence} activityId={activity.id} onChange={setEvidence} />}{["simulation", "external_link"].includes(activity.activityType) && <><p className="activity-content">{activity.instructions}</p><a className="primary" href={String(config.url)} target="_blank" rel="noreferrer">{String(config.label ?? "Abrir recurso")} ↗</a><div className="activity-actions"><button className="primary" aria-describedby={evidenceBlocked ? blockedHelpId : undefined} disabled={saving || isCompleted || evidenceBlocked} onClick={complete}>{isCompleted ? "Completada" : "Marcar como completada"}</button></div></>}{message && <p className="inline-message" role="status">{message}</p>}</section>;
}

function EvidenceComposer({ activityId, initialEvidence, onChange }: { activityId: string; initialEvidence?: Evidence; onChange: (evidence: Evidence) => void }) {
  const [evidence, setEvidence] = useState(initialEvidence); const [type, setType] = useState(initialEvidence?.evidenceType ?? "text"); const [title, setTitle] = useState(initialEvidence?.title ?? ""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function createOrSave(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { const values = Object.fromEntries(new FormData(event.currentTarget).entries()); const response = await fetch(evidence ? `/api/student/evidence/${evidence.id}` : "/api/student/evidence", { method: evidence ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, activityId, evidenceType: type }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setMessage(data.error ?? "No se pudo guardar."); return; } setEvidence(data.evidence); onChange(data.evidence); setMessage("Borrador guardado."); } catch { setMessage("No se pudo guardar la evidencia."); } finally { setSaving(false); } }
  async function upload(event: FormEvent<HTMLInputElement>) { const file = event.currentTarget.files?.[0]; if (!file || saving) return; setSaving(true); try { let current = evidence; if (!current) { const draft = await fetch("/api/student/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activityId, title, evidenceType: "file" }) }); const draftData = await draft.json().catch(() => ({})); if (!draft.ok) { setMessage(draftData.error ?? "No se pudo crear el borrador."); return; } current = draftData.evidence; setEvidence(current); } if (!current) return; const form = new FormData(); form.set("file", file); const response = await fetch(`/api/student/evidence/${current.id}/file`, { method: "POST", body: form }); const data = await response.json().catch(() => ({})); if (!response.ok) { setMessage(data.error ?? "No se pudo cargar el archivo."); return; } setEvidence(data.evidence); onChange(data.evidence); setMessage("Archivo cargado."); } catch { setMessage("No se pudo cargar el archivo."); } finally { setSaving(false); } }
  async function submit() { if (!evidence || saving) return; setSaving(true); try { const response = await fetch(`/api/student/evidence/${evidence.id}/submit`, { method: "POST" }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? "Evidencia enviada." : data.error ?? "No se pudo enviar la evidencia."); if (response.ok) { setEvidence(data.evidence); onChange(data.evidence); } } catch { setMessage("No se pudo enviar la evidencia."); } finally { setSaving(false); } }
  return <section className="evidence-composer" aria-busy={saving}><h3>Tu evidencia</h3>{evidence?.status === "submitted" ? <p>Enviada · {evidence.evidenceType}</p> : <form onSubmit={createOrSave}><fieldset disabled={saving}><legend className="sr-only">Editor de evidencia</legend><label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}><option value="text">Texto</option><option value="file">Archivo</option><option value="link">Enlace</option></select></label><label>Título<input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Descripción<textarea name="description" defaultValue={evidence?.description ?? ""} /></label>{type === "text" && <label>Texto<textarea name="textContent" required defaultValue={evidence?.textContent ?? ""} /></label>}{type === "link" && <label>URL HTTPS<input name="externalUrl" type="url" required defaultValue={evidence?.externalUrl ?? ""} /></label>}{type === "file" && <><input type="file" onChange={upload} accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.pptx" />{evidence?.fileName && <p>{evidence.fileName}</p>}</>}<button className="soft" disabled={saving}>Guardar borrador</button>{evidence && <button type="button" className="primary" disabled={saving} onClick={submit}>Enviar evidencia</button>}</fieldset>{message && <p className="inline-message" role="status">{message}</p>}</form>}</section>;
}
