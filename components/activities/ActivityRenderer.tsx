"use client";

import { FormEvent, useEffect, useState } from "react";

type Activity = { id: string; title: string; instructions: string; activityType: string; config: unknown };

export default function ActivityRenderer({ activity, initialResponse, completed }: { activity: Activity; initialResponse: string; completed: boolean }) {
  const [response, setResponse] = useState(initialResponse);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const config = activity.config as Record<string, unknown>;
  useEffect(() => { if (!completed) void fetch(`/api/student/activities/${activity.id}/start`, { method: "POST" }); }, [activity.id, completed]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const result = await fetch(`/api/student/activities/${activity.id}/response`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ response }) });
    const data = await result.json().catch(() => ({}));
    if (!result.ok) { setMessage(data.error ?? "No se pudo guardar la respuesta."); setSaving(false); return false; }
    setMessage("Respuesta guardada."); setSaving(false); return true;
  }
  async function complete() {
    setSaving(true); setMessage("");
    const result = await fetch(`/api/student/activities/${activity.id}/complete`, { method: "POST" });
    const data = await result.json().catch(() => ({}));
    setMessage(result.ok ? "Actividad completada." : data.error ?? "No se pudo completar."); setSaving(false);
  }
  return <section className="activity-interaction"><span className="student-label">{activity.activityType.toUpperCase()}</span><h2>{activity.title}</h2>{activity.instructions && <p className="activity-instructions">{activity.instructions}</p>}{["instruction", "reading"].includes(activity.activityType) && <><p className="activity-content">{String(config.content ?? "")}</p><button className="primary" disabled={saving || completed} onClick={complete}>{completed ? "Completada" : "Marcar como completada"}</button></>}{["question", "prediction", "reflection"].includes(activity.activityType) && <form onSubmit={save}><label>{String(config.prompt ?? "¿Qué piensas?")}<textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={7} placeholder="Escribe tu respuesta..." /></label><div className="activity-actions"><button className="soft" disabled={saving || !response.trim()}>{saving ? "Guardando…" : "Guardar respuesta"}</button><button type="button" className="primary" disabled={saving || !response.trim() || completed} onClick={async () => { const saved = await save({ preventDefault() {} } as FormEvent); if (saved) await complete(); }}>{completed ? "Completada" : "Marcar como completada"}</button></div></form>}{["simulation", "external_link"].includes(activity.activityType) && <><p className="activity-content">{activity.instructions}</p><a className="primary" href={String(config.url)} target="_blank" rel="noreferrer">{String(config.label ?? "Abrir recurso")} ↗</a><div className="activity-actions"><button className="primary" disabled={saving || completed} onClick={complete}>{completed ? "Completada" : "Marcar como completada"}</button></div></>}{message && <p className="inline-message" role="status">{message}</p>}</section>;
}
