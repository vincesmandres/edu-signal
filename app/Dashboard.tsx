"use client";

import { useState } from "react";

const students = [
  { name: "Luna Paredes", initials: "LP", color: "violet", signal: 94, project: "Huerto orbital" },
  { name: "Mateo Cruz", initials: "MC", color: "yellow", signal: 87, project: "Robot recolector" },
  { name: "Sofía Vega", initials: "SV", color: "blue", signal: 91, project: "Sonidos del agua" },
];
const evidence = [["HOY", "Prototipo subido", "Robot recolector", "M. Cruz", "+8"], ["AYER", "Rúbrica completada", "Pensamiento sistémico", "S. Vega", "+5"], ["JUL 29", "Credencial emitida", "Explorador STEAM", "L. Paredes", "+12"]];

export default function Dashboard({ user }: { user: { displayName: string; email: string } }) {
  const [tab, setTab] = useState("Inicio");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2500); };
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  const initials = user.displayName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <main className="shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <nav className="topbar" aria-label="Navegación principal">
      <button className="brand" onClick={() => setTab("Inicio")} aria-label="Edu Signal inicio"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></button>
      <div className="nav-links"><a href="/classrooms">Aulas</a>{["Inicio", "Estudiantes", "Rúbricas", "Evidencias"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className="nav-actions"><button className="bell" onClick={() => notify("No hay alertas críticas.")} aria-label="Alertas">◌<b /></button><div className="account"><button className="profile" onClick={() => notify(`Sesión activa: ${user.email}`)} aria-label={`Cuenta de ${user.displayName}`}>{initials}</button><button onClick={signOut} className="signout">Salir</button></div></div>
    </nav>
    <section className="hero"><div className="eyebrow"><span />COLEGIO AURORA · LAB 04</div><h1>Aprendizaje que<br/><em>deja señal.</em></h1><p>Convierte proyectos reales en evidencia clara, evaluación justa y credenciales que acompañan a cada estudiante.</p><div className="hero-buttons"><button className="primary" onClick={() => setModal(true)}>Crear evidencia <span>→</span></button><button className="soft" onClick={() => notify("Modo recorrido activado.")}>Ver recorrido <span>↗</span></button></div><div className="floating-card orbit-card"><span className="pixel-icon">✦</span><div><small>SEÑAL DE HOY</small><strong>+27 puntos</strong></div></div><div className="floating-card badge-card"><span className="mini-cube">▪</span><div><small>NUEVA INSIGNIA</small><strong>Explorador STEAM</strong></div></div><div className="blocks" aria-hidden="true"><span className="block b1"/><span className="block b2"/><span className="block b3"/><span className="block b4"/><span className="block b5"/><span className="block b6"/><div className="planet">◉</div></div></section>
    <section className="signal-strip"><div><small>SEÑAL COLECTIVA</small><strong>1,248 <i>↑ 12%</i></strong></div><div className="bar-chart"><i/><i/><i/><i/><i/><i/><i/></div><p>Tu comunidad está aprendiendo en voz alta.</p></section>
    <section className="content-grid"><div className="section-heading"><div><small>PULSO DEL AULA</small><h2>En movimiento</h2></div><button onClick={() => setTab("Estudiantes")}>Ver estudiantes <span>→</span></button></div><div className="student-grid">{students.map((student) => <article className="student-card" key={student.name}><div className={`avatar ${student.color}`}>{student.initials}</div><div className="student-top"><span className="status-dot"/> ACTIVO</div><h3>{student.name}</h3><p>{student.project}</p><div className="signal-row"><span>SEÑAL</span><strong>{student.signal}%</strong></div><div className="progress"><i style={{ width: `${student.signal}%` }} /></div><button onClick={() => notify(`Abriendo perfil de ${student.name}`)}>Ver trayecto →</button></article>)}</div><div className="section-heading evidence-heading"><div><small>BITÁCORA VIVA</small><h2>Últimas evidencias</h2></div><button onClick={() => setModal(true)}>+ Nueva evidencia</button></div><div className="evidence-list">{evidence.map(([date, action, project, person, points]) => <article key={project}><time>{date}</time><div className="evidence-mark">✦</div><div><h3>{action}</h3><p>{project} · {person}</p></div><strong>{points}<small> SEÑAL</small></strong><button onClick={() => notify(`Detalle de ${project} listo para revisar`)}>→</button></article>)}</div></section>
    <footer><span className="brand-block">E</span> EDU SIGNAL <i>· evidencias que importan</i><span>PRIVADO POR DISEÑO · ZK READY</span></footer>{toast && <div className="toast">✦ {toast}</div>}{modal && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><button className="close" onClick={() => setModal(false)} aria-label="Cerrar">×</button><small>NUEVA EVIDENCIA</small><h2>¿Qué aprendieron hoy?</h2><input aria-label="Nombre del proyecto" placeholder="Nombre del proyecto" autoFocus/><select aria-label="Competencia"><option>Selecciona una competencia</option><option>Pensamiento crítico</option><option>Creatividad aplicada</option><option>Trabajo colaborativo</option></select><button className="primary wide" onClick={() => { setModal(false); notify("Evidencia guardada. La señal ya está creciendo."); }}>Guardar evidencia →</button></div></div>}</main>;
}
