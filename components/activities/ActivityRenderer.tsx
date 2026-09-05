"use client";

import { FormEvent, useEffect, useState } from "react";

type Activity = { id: string; title: string; instructions: string; activityType: string; config: unknown };
type Evidence = { id: string; title: string; description?: string | null; fileName?: string | null; evidenceType: string; status: string; textContent?: string | null; externalUrl?: string | null } | null;

export default function ActivityRenderer({ activity, initialResponse, completed, initialEvidence }: { activity: Activity & { requiresEvidence?: boolean }; initialResponse: string; completed: boolean; initialEvidence?: Evidence }) {
  const [response, setResponse] = useState(initialResponse);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const config = activity.config as Record<string, unknown>;
  useEffect(() => { if (!completed) void fetch(`/api/student/activities/${activity.id}/start`, { method: "POST" }); }, [activity.id, completed]);
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
    setMessage(result.ok ? "Actividad completada." : data.error ?? "No se pudo completar."); setSaving(false);
  }
  return <section className="activity-interaction"><span className="student-label">{activity.activityType.toUpperCase()}</span><h2>{activity.title}</h2>{activity.instructions && <p className="activity-instructions">{activity.instructions}</p>}{["instruction", "reading"].includes(activity.activityType) && <><p className="activity-content">{String(config.content ?? "")}</p><button className="primary" disabled={saving || completed || activity.requiresEvidence} onClick={complete}>{completed ? "Completada" : "Marcar como completada"}</button></>}{["question", "prediction", "reflection"].includes(activity.activityType) && <form onSubmit={save}><label>{String(config.prompt ?? "¿Qué piensas?")}<textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={7} placeholder="Escribe tu respuesta..." /></label><div className="activity-actions"><button className="soft" disabled={saving || !response.trim()}>{saving ? "Guardando…" : "Guardar respuesta"}</button><button type="button" className="primary" disabled={saving || !response.trim() || completed || activity.requiresEvidence} onClick={async () => { const saved = await saveResponse(); if (saved) await complete(); }}>{completed ? "Completada" : "Marcar como completada"}</button></div></form>}{activity.requiresEvidence && <EvidenceComposer initialEvidence={initialEvidence} activityId={activity.id} />}{["simulation", "external_link"].includes(activity.activityType) && <><p className="activity-content">{activity.instructions}</p><a className="primary" href={String(config.url)} target="_blank" rel="noreferrer">{String(config.label ?? "Abrir recurso")} ↗</a><div className="activity-actions"><button className="primary" disabled={saving || completed || activity.requiresEvidence} onClick={complete}>{completed ? "Completada" : "Marcar como completada"}</button></div></>}{message && <p className="inline-message" role="status">{message}</p>}</section>;
}

function EvidenceComposer({ activityId, initialEvidence }: { activityId: string; initialEvidence?: Evidence }) {
  const [evidence, setEvidence] = useState(initialEvidence); const [type, setType] = useState(initialEvidence?.evidenceType ?? "text"); const [title, setTitle] = useState(initialEvidence?.title ?? ""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function createOrSave(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); const response = await fetch(evidence ? `/api/student/evidence/${evidence.id}` : "/api/student/evidence", { method: evidence ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, activityId, evidenceType: type }) }); const data = await response.json(); setSaving(false); if (!response.ok) { setMessage(data.error ?? "No se pudo guardar."); return; } setEvidence(data.evidence); setMessage("Borrador guardado."); }
  async function upload(event: FormEvent<HTMLInputElement>) { const file = event.currentTarget.files?.[0]; if (!file) return; let current = evidence; if (!current) { const draft = await fetch("/api/student/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ activityId, title, evidenceType: "file" }) }); const draftData = await draft.json(); if (!draft.ok) { setMessage(draftData.error); return; } current = draftData.evidence; setEvidence(current); } if (!current) return; const form = new FormData(); form.set("file", file); const response = await fetch(`/api/student/evidence/${current.id}/file`, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) { setMessage(data.error); return; } setEvidence(data.evidence); setMessage("Archivo cargado."); }
  async function submit() { if (!evidence) return; const response = await fetch(`/api/student/evidence/${evidence.id}/submit`, { method: "POST" }); const data = await response.json(); setMessage(response.ok ? "Evidencia enviada." : data.error); if (response.ok) setEvidence(data.evidence); }
  return <section className="evidence-composer"><h3>Tu evidencia</h3>{evidence?.status === "submitted" ? <p>Enviada · {evidence.evidenceType}</p> : <form onSubmit={createOrSave}><label>Tipo<select value={type} onChange={(e) => setType(e.target.value)}><option value="text">Texto</option><option value="file">Archivo</option><option value="link">Enlace</option></select></label><label>Título<input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>Descripción<textarea name="description" defaultValue={evidence?.description ?? ""} /></label>{type === "text" && <label>Texto<textarea name="textContent" required defaultValue={evidence?.textContent ?? ""} /></label>}{type === "link" && <label>URL HTTPS<input name="externalUrl" type="url" required defaultValue={evidence?.externalUrl ?? ""} /></label>}{type === "file" && <><input type="file" onChange={upload} accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.pptx" />{evidence?.fileName && <p>{evidence.fileName}</p>}</>}<button className="soft" disabled={saving}>Guardar borrador</button>{evidence && <button type="button" className="primary" onClick={submit}>Enviar evidencia</button>}{message && <p className="inline-message">{message}</p>}</form>}</section>;
}
