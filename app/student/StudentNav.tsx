"use client";

import Link from "next/link";

export default function StudentNav({ displayName }: { displayName: string }) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return <nav className="student-nav" aria-label="Navegación del espacio de aprendizaje"><Link className="brand" href="/student"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><div className="student-links"><Link href="/student">Inicio</Link><Link href="/student/classrooms">Mis aulas</Link></div><div className="student-account"><span aria-label={`Cuenta de ${displayName}`}>{displayName}</span><button className="signout" onClick={signOut}>Salir</button></div></nav>;
}
