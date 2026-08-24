import Link from "next/link";

export default function ForbiddenPage() {
  return <main className="auth-shell"><div className="auth-card"><small>ACCESO DENEGADO</small><h1>Este espacio no corresponde a tu rol.</h1><p>Vuelve a tu workspace para continuar.</p><Link className="primary wide" href="/">Volver al inicio</Link></div></main>;
}
