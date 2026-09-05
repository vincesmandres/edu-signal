import { getApiProfile } from "../../../../lib/auth";

export async function POST() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  return Response.json({ error: "La carga docente de evidencias es una ruta histórica de solo lectura." }, { status: 410 });
}
