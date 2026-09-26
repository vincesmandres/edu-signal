"use client";

import { useEffect, useState } from "react";
import type { FormativeFeedback, InquiryCycleConfig, InquiryResponse, SelfAssessment } from "@/lib/ai/contracts";

type DraftResponse = Partial<InquiryResponse>;
type RubricCriterion = { id: string; name: string; description: string; maxScore: string };
type AttemptData = {
  attempt: { status: string; currentRevision: number; revisionLimit: number };
  version: { stageResponses: DraftResponse; status: string } | null;
  selfAssessment: ({ confidence: number; rationale: string; criteria: Array<{ criterionId: string; score: string; rationale: string }> }) | null;
  formativeFeedback: { status: string; feedback: Omit<FormativeFeedback, "proposedScores"> | null } | null;
  history: Array<{ id: string; revision: number; stageResponses: Record<string, unknown>; submittedAt: string | null; reviewStatus: string | null; publicFeedback: string | null; requiredImprovements: string[] | null }>;
} | null;

export default function InquiryCycleRenderer({ activity }: { activity: { id: string; title: string; instructions: string; config: unknown } }) {
  const config = activity.config as InquiryCycleConfig;
  const [data, setData] = useState<AttemptData>(null);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [response, setResponse] = useState<DraftResponse>({});
  const [selfAssessment, setSelfAssessment] = useState<Partial<SelfAssessment>>({ confidence: 3, rationale: "", criteria: [] });
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(true);
  const endpoint = `/api/student/activities/${activity.id}/attempt`;

  useEffect(() => {
    let active = true;
    void fetch(endpoint, { method: "POST" }).then(async (result) => ({ ok: result.ok, body: await result.json() })).then(({ ok, body }) => {
      if (!active) return;
      if (!ok) { setMessage(body.error ?? "No se pudo iniciar el ciclo."); setSaving(false); return; }
      setData(body.data); setRubric(body.rubric ?? []);
      setResponse(body.data?.version?.stageResponses ?? {});
      if (body.data?.selfAssessment) setSelfAssessment({ confidence: body.data.selfAssessment.confidence, rationale: body.data.selfAssessment.rationale, criteria: body.data.selfAssessment.criteria.map((item: { criterionId: string; score: string; rationale: string }) => ({ ...item, score: Number(item.score) })) });
      setSaving(false);
    }).catch(() => { if (active) { setMessage("No se pudo iniciar el ciclo."); setSaving(false); } });
    return () => { active = false; };
  }, [endpoint]);

  const submitted = data?.version?.status === "submitted";
  async function save(nextStep?: number) {
    setSaving(true); setMessage("");
    const result = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ response, selfAssessment: step === 5 ? selfAssessment : undefined }) });
    const body = await result.json().catch(() => ({}));
    setSaving(false);
    if (!result.ok) { setMessage(body.error ?? "No se pudo guardar el borrador."); return false; }
    setData(body.data); setMessage("Borrador guardado."); if (nextStep !== undefined) setStep(nextStep); return true;
  }
  async function submit() {
    if (!(await save())) return;
    setSaving(true);
    const result = await fetch(`${endpoint}/submit`, { method: "POST" });
    const body = await result.json().catch(() => ({}));
    setSaving(false); setMessage(result.ok ? "Ciclo enviado. La retroalimentación se está preparando." : body.error ?? "No se pudo enviar.");
    if (result.ok) {
      const refreshed = await fetch(endpoint).then((response) => response.json());
      setData(refreshed.data);
    }
  }
  function criterionValue(id: string) { return selfAssessment.criteria?.find((item) => item.criterionId === id); }
  function updateCriterion(id: string, field: "score" | "rationale", value: string) {
    const existing = selfAssessment.criteria ?? [];
    const current = existing.find((item) => item.criterionId === id) ?? { criterionId: id, score: 0, rationale: "" };
    setSelfAssessment({ ...selfAssessment, criteria: [...existing.filter((item) => item.criterionId !== id), { ...current, [field]: field === "score" ? Number(value) : value }] });
  }
  const interpretations = response.interpretations ?? [{ interpretation: "", assumptions: "" }, { interpretation: "", assumptions: "" }];
  const evidence = response.evidenceContrast?.[0] ?? { source: "", citation: "", relationship: "supports" as const, explanation: "" };

  if (submitted) return <section className="activity-interaction"><span className="student-label">CICLO DE INDAGACIÓN · REVISIÓN {data?.attempt.currentRevision ?? 0}</span><h2>{activity.title}</h2><p>Tu razonamiento quedó guardado como una versión inmutable.</p>{data?.formativeFeedback?.status === "completed" && data.formativeFeedback.feedback && <article className="student-activity-card"><h3>Retroalimentación formativa</h3><strong>Fortalezas</strong><ul>{data.formativeFeedback.feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul><strong>Preguntas para profundizar</strong><ul>{data.formativeFeedback.feedback.socraticQuestions.map((item) => <li key={item}>{item}</li>)}</ul><p><b>Siguiente acción:</b> {data.formativeFeedback.feedback.nextAction}</p></article>}{data?.formativeFeedback?.status === "failed" && <p>Tu trabajo fue enviado. La retroalimentación no está disponible todavía.</p>}<h3>Historial de versiones</h3>{data?.history.map((item) => <details key={item.id}><summary>Versión {item.revision} · {item.reviewStatus ?? "sin revisión"}</summary>{item.publicFeedback && <p>{item.publicFeedback}</p>}<pre>{JSON.stringify(item.stageResponses, null, 2)}</pre></details>)}</section>;

  const returned = data?.history.find((item) => item.reviewStatus === "returned");
  return <section className="activity-interaction" aria-busy={saving}><span className="student-label">CICLO DE INDAGACIÓN · PASO {step + 1} DE 6</span><h2>{activity.title}</h2><p className="activity-instructions">{activity.instructions}</p><p><b>Objetivo:</b> {config.objective}</p>{returned?.requiredImprovements?.length ? <article className="student-activity-card"><b>Mejoras requeridas por tu docente</b><ul>{returned.requiredImprovements.map((item) => <li key={item}>{item}</li>)}</ul></article> : null}
    {step === 0 && <label>{config.stages[0].prompt}<textarea rows={7} value={response.prediction ?? ""} onChange={(event) => setResponse({ ...response, prediction: event.target.value })} disabled={response.prediction !== undefined && data?.version?.stageResponses.prediction !== undefined} /></label>}
    {step === 1 && <>{interpretations.map((item, index) => <fieldset key={index}><legend>Interpretación {index + 1}</legend><label>Interpretación<textarea value={item.interpretation} onChange={(event) => { const copy = [...interpretations] as typeof interpretations; copy[index] = { ...copy[index], interpretation: event.target.value }; setResponse({ ...response, interpretations: copy }); }} /></label><label>Supuestos<textarea value={item.assumptions} onChange={(event) => { const copy = [...interpretations] as typeof interpretations; copy[index] = { ...copy[index], assumptions: event.target.value }; setResponse({ ...response, interpretations: copy }); }} /></label></fieldset>)}</>}
    {step === 2 && <fieldset><legend>{config.stages[2].title}</legend><label>Fuente, simulación u observación<input value={evidence.source} onChange={(event) => setResponse({ ...response, evidenceContrast: [{ ...evidence, source: event.target.value }] })} /></label><label>Cita o referencia<input value={evidence.citation} onChange={(event) => setResponse({ ...response, evidenceContrast: [{ ...evidence, citation: event.target.value }] })} /></label><label>Relación<select value={evidence.relationship} onChange={(event) => setResponse({ ...response, evidenceContrast: [{ ...evidence, relationship: event.target.value as typeof evidence.relationship }] })}><option value="supports">Apoya</option><option value="contradicts">Contradice</option><option value="complicates">Matiza</option></select></label><label>Explicación<textarea value={evidence.explanation} onChange={(event) => setResponse({ ...response, evidenceContrast: [{ ...evidence, explanation: event.target.value }] })} /></label></fieldset>}
    {step === 3 && <><article className="student-activity-card"><small>RESPUESTA ALTERNATIVA PARA CRITICAR</small><p>{config.alternativeAnswer}</p></article><label>{config.stages[3].prompt}<textarea rows={7} value={response.alternativeCritique ?? ""} onChange={(event) => setResponse({ ...response, alternativeCritique: event.target.value })} /></label></>}
    {step === 4 && <><label>{config.stages[4].prompt}<textarea rows={7} value={response.revisedSynthesis ?? ""} onChange={(event) => setResponse({ ...response, revisedSynthesis: event.target.value })} /></label><label>¿Qué cambió frente a tu predicción inicial?<textarea value={response.changeFromPrediction ?? ""} onChange={(event) => setResponse({ ...response, changeFromPrediction: event.target.value })} /></label><fieldset><legend>Declaración de uso de IA</legend><label><input type="checkbox" checked={response.aiUse?.used ?? false} onChange={(event) => setResponse({ ...response, aiUse: event.target.checked ? { used: true, tool: "", purpose: "", importantSuggestion: "", acceptedOrRejected: "", reasoning: "" } : { used: false } })} /> Usé una herramienta de IA</label>{response.aiUse?.used && <><label>Herramienta<input value={response.aiUse.tool} onChange={(event) => setResponse({ ...response, aiUse: { ...response.aiUse as Extract<InquiryResponse["aiUse"], { used: true }>, tool: event.target.value } })} /></label><label>Propósito<textarea value={response.aiUse.purpose} onChange={(event) => setResponse({ ...response, aiUse: { ...response.aiUse as Extract<InquiryResponse["aiUse"], { used: true }>, purpose: event.target.value } })} /></label><label>Sugerencia importante<textarea value={response.aiUse.importantSuggestion} onChange={(event) => setResponse({ ...response, aiUse: { ...response.aiUse as Extract<InquiryResponse["aiUse"], { used: true }>, importantSuggestion: event.target.value } })} /></label><label>Qué aceptaste o rechazaste<textarea value={response.aiUse.acceptedOrRejected} onChange={(event) => setResponse({ ...response, aiUse: { ...response.aiUse as Extract<InquiryResponse["aiUse"], { used: true }>, acceptedOrRejected: event.target.value } })} /></label><label>Por qué<textarea value={response.aiUse.reasoning} onChange={(event) => setResponse({ ...response, aiUse: { ...response.aiUse as Extract<InquiryResponse["aiUse"], { used: true }>, reasoning: event.target.value } })} /></label></>}</fieldset></>}
    {step === 5 && <><label>Confianza (1-5)<input type="number" min="1" max="5" value={selfAssessment.confidence ?? 3} onChange={(event) => setSelfAssessment({ ...selfAssessment, confidence: Number(event.target.value) })} /></label><label>Razonamiento de tu autoevaluación<textarea value={selfAssessment.rationale ?? ""} onChange={(event) => setSelfAssessment({ ...selfAssessment, rationale: event.target.value })} /></label>{rubric.map((criterion) => <fieldset key={criterion.id}><legend>{criterion.name}</legend><p>{criterion.description}</p><label>Puntuación (0-{criterion.maxScore})<input type="number" min="0" max={criterion.maxScore} value={criterionValue(criterion.id)?.score ?? 0} onChange={(event) => updateCriterion(criterion.id, "score", event.target.value)} /></label><label>Justificación<textarea value={criterionValue(criterion.id)?.rationale ?? ""} onChange={(event) => updateCriterion(criterion.id, "rationale", event.target.value)} /></label></fieldset>)}</>}
    <div className="activity-actions">{step > 0 && <button className="soft" disabled={saving} onClick={() => setStep(step - 1)}>Anterior</button>}{step < 5 ? <button className="primary" disabled={saving} onClick={() => void save(step + 1)}>{saving ? "Guardando…" : "Guardar y continuar"}</button> : <button className="primary" disabled={saving} onClick={() => void submit()}>{saving ? "Enviando…" : "Enviar versión"}</button>}</div>{message && <p className="inline-message" role="status">{message}</p>}
  </section>;
}
