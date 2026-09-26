import { getApiProfile } from "@/lib/auth";

export async function POST() {
  const auth = await getApiProfile("teacher");
  if (!auth.profile) return Response.json({ error: auth.status === 401 ? "Unauthenticated" : "Forbidden" }, { status: auth.status });
  return Response.json({ error: "Use /api/ai/curriculum/generations." }, { status: 410, headers: { "cache-control": "no-store" } });
}
