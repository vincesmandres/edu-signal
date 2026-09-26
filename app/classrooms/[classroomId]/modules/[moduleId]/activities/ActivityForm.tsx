"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const types = ["instruction", "question", "prediction", "simulation", "external_link", "reflection", "reading", "inquiry_cycle"];
const stageKinds = ["prediction", "interpretations", "evidence_contrast", "alternative_critique", "revised_synthesis", "self_assessment"] as const;

function defaultConfig(type: string): Record<string, unknown> {
  if (["instruction", "reading"].includes(type)) return { content: "" };
  if (["question", "prediction", "reflection"].includes(type)) return { prompt: "", ...(type === "question" ? { responseType: "long_text" } : {}) };
  if (type === "external_link") return { url: "", label: "" };
  if (type === "simulation") return { url: "", provider: "phet" };
  return { objective: "", estimatedMinutes: 60, stages: stageKinds.map((kind) => ({ kind, title: kind.replaceAll("_", " "), prompt: "", required: true })), citationRequired: true, requiredResourceIds: [], aiDisclosureRequired: true, maximumRevisions: 2, alternativeAnswer: "" };
}

type Activity = { id: string; title: string; instructions: string; activityType: string; config: unknown; required: boolean; requiresEvidence: boolean; status: string; position: number };

export default function ActivityForm({ classroomId, moduleId, activity }: { classroomId: string; moduleId: string; activity?: Activity }) {
  const router = useRouter();
  const [type, setType] = useState(activity?.activityType ?? "instruction");
  const [config, setConfig] = useState<Record<string, unknown>>(activity?.config && typeof activity.config === "object" && !Array.isArray(activity.config) ? activity.config as Record<string, unknown> : defaultConfig(activity?.activityType ?? "instruction"));
  const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  function changeType(next: string) { setType(next); setConfig(defaultConfig(next)); }
  function field(name: string, value: unknown) { setConfig((current) => ({ ...current, [name]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget);
    const payload = { title: String(form.get("title") ?? ""), instructions: String(form.get("instructions") ?? ""), activityType: type, position: Number(form.get("position") ?? 1), required: form.get("required") === "on", requiresEvidence: form.get("requiresEvidence") === "on", config, status: String(form.get("status") ?? "draft") };
    const response = await fetch(activity ? `/api/activities/${activity.id}` : `/api/modules/${moduleId}/activities`, { method: activity ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "No se pudo guardar."); return; }
    router.push(`/classrooms/${classroomId}/modules/${moduleId}`); router.refresh();
  }
  const stages = Array.isArray(config.stages) ? config.stages as Array<{ kind: string; title: string; prompt: string; required: true }> : [];
  return <main className="studio-shell"><nav className="studio-nav"><Link className="brand" href="/classrooms"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><span className="teacher-chip">ACTIVIDAD</span></nav><section className="workspace-grid"><form className="modal workspace-form" onSubmit={submit}><small>{activity ? "EDITAR ACTIVIDAD" : "NUEVA ACTIVIDAD"}</small><h1>{activity ? "Ajusta el recorrido." : "Crea un siguiente paso."}</h1><label>Título<input name="title" required defaultValue={activity?.title} /></label><label>Instrucciones<textarea name="instructions" defaultValue={activity?.instructions} /></label><label>Tipo<select name="activityType" value={type} onChange={(event) => changeType(event.target.value)}>{types.map((item) => <option key={item}>{item}</option>)}</select></label>
    {["instruction", "reading"].includes(type) && <label>Contenido<textarea required value={String(config.content ?? "")} onChange={(event) => field("content", event.target.value)} rows={8} /></label>}
    {["question", "prediction", "reflection"].includes(type) && <label>Pregunta<textarea required value={String(config.prompt ?? "")} onChange={(event) => field("prompt", event.target.value)} /></label>}
    {type === "question" && <label>Tipo de respuesta<select value={String(config.responseType ?? "long_text")} onChange={(event) => field("responseType", event.target.value)}><option value="short_text">Texto corto</option><option value="long_text">Texto largo</option></select></label>}
    {type === "external_link" && <><label>URL HTTPS<input type="url" required value={String(config.url ?? "")} onChange={(event) => field("url", event.target.value)} /></label><label>Etiqueta<input required value={String(config.label ?? "")} onChange={(event) => field("label", event.target.value)} /></label></>}
    {type === "simulation" && <><label>URL HTTPS<input type="url" required value={String(config.url ?? "")} onChange={(event) => field("url", event.target.value)} /></label><label>Proveedor<select value={String(config.provider ?? "phet")} onChange={(event) => field("provider", event.target.value)}><option value="phet">PhET</option><option value="external">Externo</option></select></label></>}
    {type === "inquiry_cycle" && <><label>Objetivo<textarea required value={String(config.objective ?? "")} onChange={(event) => field("objective", event.target.value)} /></label><div className="form-row"><label>Minutos estimados<input type="number" min="10" max="600" value={Number(config.estimatedMinutes ?? 60)} onChange={(event) => field("estimatedMinutes", Number(event.target.value))} /></label><label>Revisiones máximas<input type="number" min="0" max="2" value={Number(config.maximumRevisions ?? 2)} onChange={(event) => field("maximumRevisions", Number(event.target.value))} /></label></div>{stages.map((stage, index) => <fieldset key={stage.kind}><legend>{index + 1}. {stage.title}</legend><label>Consigna<textarea required value={stage.prompt} onChange={(event) => field("stages", stages.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item))} /></label></fieldset>)}<label>Respuesta alternativa para criticar<textarea required value={String(config.alternativeAnswer ?? "")} onChange={(event) => field("alternativeAnswer", event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={Boolean(config.citationRequired)} onChange={(event) => field("citationRequired", event.target.checked)} /> Requiere citas</label><label className="checkbox-label"><input type="checkbox" checked={Boolean(config.aiDisclosureRequired)} onChange={(event) => field("aiDisclosureRequired", event.target.checked)} /> Requiere declaración de uso de IA</label></>}
    <label>Posición<input name="position" type="number" min="1" defaultValue={activity?.position ?? 1} /></label><label className="checkbox-label"><input name="required" type="checkbox" defaultChecked={activity?.required ?? true} /> Actividad requerida</label><label className="checkbox-label"><input name="requiresEvidence" type="checkbox" defaultChecked={activity?.requiresEvidence ?? type === "inquiry_cycle"} /> Requiere evidencia formal</label>{activity && <label>Estado<select name="status" defaultValue={activity.status}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label>}{message && <p className="auth-error" role="alert">{message}</p>}<button className="primary wide" disabled={saving}>{saving ? "Guardando…" : "Guardar actividad →"}</button></form></section></main>;
}
