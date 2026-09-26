"use client";

import { useEffect, useState } from "react";

type GradeItem = { grade: { id: string; rawValue: string; normalizedPercentage: string; scaleSnapshot: { min: number; max: number }; publishedAt: string | null }; classroomName: string; activityTitle: string | null; review: { publicFeedback: string | null; requiredImprovements: string[] } | null; criteria: Array<{ id: string; score: string; feedback: string | null }> };

export default function GradesView() {
  const [items, setItems] = useState<GradeItem[] | null>(null);
  useEffect(() => { let active = true; void fetch("/api/student/grades").then((response) => response.json()).then((body) => { if (active) setItems(body.grades ?? []); }); return () => { active = false; }; }, []);
  if (!items) return <p role="status">Cargando calificaciones…</p>;
  if (!items.length) return <div className="empty-state"><b>Aún no hay calificaciones publicadas.</b><p>Las entregas devueltas para revisión se muestran dentro de cada actividad.</p></div>;
  return <section className="classroom-grid">{items.map((item) => <article className="student-activity-card" key={item.grade.id}><small>{item.classroomName}</small><h2>{item.activityTitle ?? "Resultado del aula"}</h2><p><b>{item.grade.rawValue}</b> / {item.grade.scaleSnapshot.max} · {item.grade.normalizedPercentage}%</p>{item.review?.publicFeedback && <p>{item.review.publicFeedback}</p>}{item.criteria.map((criterion) => <p key={criterion.id}>{criterion.score}{criterion.feedback ? ` · ${criterion.feedback}` : ""}</p>)}</article>)}</section>;
}
