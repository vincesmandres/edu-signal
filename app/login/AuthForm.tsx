"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function AuthForm() {
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch(registering ? "/api/auth/register" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(data.error ?? "No se pudo iniciar sesión."); return; }
    window.location.href = "/";
  }
  return <main className="auth-shell"><div className="auth-card"><Link href="/" className="auth-brand"><span className="brand-block">E</span><span>EDU<br/><i>SIGNAL</i></span></Link><small>{registering ? "CREA TU ESPACIO DOCENTE" : "ESPACIO DOCENTE"}</small><h1>{registering ? "Empieza a dejar señal." : "Bienvenido de vuelta."}</h1><p>{registering ? "Crea una cuenta para organizar aulas, estudiantes y evidencias." : "Accede a tus aulas y trayectos de aprendizaje."}</p><form onSubmit={submit}>{registering && <label>Nombre completo<input name="displayName" required autoComplete="name" placeholder="Ej. Ana Torres" /></label>}<label>Correo electrónico<input name="email" required type="email" autoComplete="email" placeholder="docente@colegio.edu" /></label><label>Contraseña<input name="password" required type="password" minLength={8} autoComplete={registering ? "new-password" : "current-password"} placeholder="Mínimo 8 caracteres" /></label>{message && <div className="auth-error" role="alert">{message}</div>}<button className="primary wide" disabled={busy}>{busy ? "Procesando…" : registering ? "Crear cuenta →" : "Iniciar sesión →"}</button></form><button className="auth-switch" onClick={() => { setRegistering(!registering); setMessage(""); }}>{registering ? "Ya tengo una cuenta" : "Crear cuenta docente"}</button></div></main>;
}
