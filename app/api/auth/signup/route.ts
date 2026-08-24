import { createClient } from "../../../../lib/supabase/server";
import { recordAudit } from "../../../audit";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { displayName?: string; email?: string; password?: string };
    const displayName = body.displayName?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!displayName || !email || !body.password || body.password.length < 8) {
      return Response.json({ error: "Nombre, correo y una contraseña de al menos 8 caracteres son obligatorios." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: { data: { display_name: displayName } },
    });
    if (error) return Response.json({ error: "No se pudo crear la cuenta. Verifica los datos e inténtalo de nuevo." }, { status: 400 });
    if (!data.user) return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });

    await recordAudit({ actorId: data.user.id, action: "user_signed_up", entityType: "user", entityId: data.user.id });
    return Response.json({
      user: { id: data.user.id, displayName, email },
      redirectTo: data.session ? "/student" : "/login?registered=1",
      confirmationRequired: !data.session,
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("signup_failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
