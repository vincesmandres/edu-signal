import { getCurrentUser } from "../../../../lib/auth";
import { createClient } from "../../../../lib/supabase/server";
import { recordAudit } from "../../../audit";

export async function POST() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (user) await recordAudit({ actorId: user.id, action: "user_signed_out", entityType: "user", entityId: user.id });
  const { error } = await supabase.auth.signOut();
  if (error) return Response.json({ error: "No se pudo cerrar la sesión." }, { status: 500 });
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
