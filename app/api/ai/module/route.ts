import { getApiProfile } from "../../../../lib/auth";

export async function POST() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  return Response.json({ error: "AI provider not configured." }, { status: 503, headers: { "cache-control": "no-store" } });
}
