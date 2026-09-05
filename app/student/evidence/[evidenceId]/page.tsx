import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../../../db";
import { evidences } from "../../../../db/schema";
import { requireStudent } from "../../../../lib/student/require-student";
import { createEvidenceDownloadUrl } from "../../../../lib/storage/evidence-storage";

export default async function StudentEvidenceDetail({ params }: { params: Promise<{ evidenceId: string }> }) {
  const { student } = await requireStudent(); const id = (await params).evidenceId;
  const evidence = (await getDb().select().from(evidences).where(eq(evidences.id, id)).limit(1))[0];
  if (!evidence || evidence.studentId !== student.id) notFound();
  const fileUrl = evidence.storageKey ? await createEvidenceDownloadUrl(evidence.storageKey) : null;
  return <main className="student-main student-subpage"><header className="student-activity-header"><Link className="back-link" href="/student/evidence">← Mis evidencias</Link><span className="student-label">{evidence.status}</span></header><section className="student-content activity-page"><h1>{evidence.title}</h1>{evidence.description && <p>{evidence.description}</p>}{evidence.textContent && <p className="activity-content">{evidence.textContent}</p>}{evidence.externalUrl && <a className="primary" href={evidence.externalUrl} target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>}{evidence.fileName && <a className="primary" href={fileUrl ?? "#"} target="_blank" rel="noopener noreferrer">Abrir {evidence.fileName} ↗</a>}</section></main>;
}
