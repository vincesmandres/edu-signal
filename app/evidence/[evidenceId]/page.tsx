import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireRole } from "../../../lib/auth";
import EvidenceEvaluation from "./EvidenceEvaluation";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailPage({ params }: { params: Promise<{ evidenceId: string }> }) {
  await requireRole("teacher", "/evidence");
  const id = (await params).evidenceId;
  const requestHeaders = await headers();
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/evidence/${id}`, { cache: "no-store", headers: { cookie: requestHeaders.get("cookie") ?? "" } });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("No se pudo cargar la evidencia.");
  const data = await response.json();
  const evidence = data.evidence;
  return <main className="student-main student-subpage"><header className="student-module-header"><Link className="back-link" href="/evidence">← Inbox de evidencias</Link><span className="student-label">EVIDENCIA ENVIADA</span><h1>{evidence.title}</h1><p>{evidence.studentName} · {evidence.classroomName}</p></header><section className="student-content"><article className="modal"><p><b>Estudiante:</b> {evidence.studentName}</p><p><b>Aula:</b> {evidence.classroomName}</p><p><b>Módulo:</b> {evidence.moduleTitle ?? "Sin módulo"}</p><p><b>Actividad:</b> {evidence.activityTitle ?? "Sin actividad"}</p><p><b>Tipo:</b> {evidence.evidenceType} · <b>Estado:</b> {evidence.status}</p><p><b>Enviada:</b> {evidence.submittedAt ? new Date(evidence.submittedAt).toLocaleString("es-ES") : "Sin fecha"}</p>{evidence.evidenceType === "text" && <div><h2>Contenido</h2><p>{evidence.textContent}</p></div>}{evidence.evidenceType === "link" && <div><h2>Enlace</h2><a href={evidence.externalUrl} target="_blank" rel="noreferrer">{evidence.externalUrl}</a></div>}{evidence.evidenceType === "file" && <EvidenceFileDownload evidenceId={id} fileName={evidence.fileName} />}</article><EvidenceEvaluation evidenceId={id} classroomId={evidence.classroomId} rubrics={data.rubrics} evaluations={data.evaluations} /></section></main>;
}

function EvidenceFileDownload({ evidenceId, fileName }: { evidenceId: string; fileName?: string | null }) {
  return <p><a className="primary" href={`/api/evidence/${evidenceId}/download`} download>{fileName ?? "Descargar archivo"}</a></p>;
}
