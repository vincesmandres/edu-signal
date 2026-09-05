import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityRenderer from "../../../../../../components/activities/ActivityRenderer";
import { getStudentActivities } from "../../../../../../lib/student/get-student-activities";

export default async function StudentActivityPage({ params }: { params: Promise<{ moduleId: string; activityId: string }> }) {
  const { moduleId, activityId } = await params;
  const data = await getStudentActivities(moduleId);
  const index = data.activities.findIndex(({ activity }) => activity.id === activityId);
  if (index < 0) notFound();
  const current = data.activities[index];
  const previous = data.activities[index - 1]?.activity;
  const next = data.activities[index + 1]?.activity;
  return <main className="student-main student-subpage"><header className="student-activity-header"><Link className="back-link" href={`/student/modules/${moduleId}`}>← {data.module.title}</Link><span className="student-label">{String(index + 1).padStart(2, "0")} / {String(data.activities.length).padStart(2, "0")}</span></header><section className="student-content activity-page"><ActivityRenderer activity={current.activity} initialResponse={current.response?.response ?? ""} completed={current.progress?.status === "completed"} initialEvidence={current.evidence} /><nav className="activity-nav" aria-label="Navegar actividades">{previous ? <Link className="soft" href={`/student/modules/${moduleId}/activities/${previous.id}`}>← Anterior</Link> : <span />}{next ? <Link className="primary" href={`/student/modules/${moduleId}/activities/${next.id}`}>Siguiente →</Link> : <Link className="primary" href={`/student/modules/${moduleId}`}>Volver al módulo</Link>}</nav></section></main>;
}
