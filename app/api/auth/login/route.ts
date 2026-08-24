import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import { createClient } from "../../../../lib/supabase/server";
import { recordAudit } from "../../../audit";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) return Response.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (error) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });

    const user = data.user;
    if (!user) return Response.json({ error: "No se pudo validar la sesión." }, { status: 401 });
    const profile = (await getDb().select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
    if (!profile) {
      await supabase.auth.signOut();
      return Response.json({ error: "La cuenta no tiene un perfil válido." }, { status: 403 });
    }
    await recordAudit({ actorId: user.id, action: "user_signed_in", entityType: "user", entityId: user.id });
    const redirectTo = profile.role === "student" ? "/student" : profile.role === "teacher" ? "/" : `/${profile.role}`;
    return Response.json({ user: { id: user.id, displayName: profile.displayName, email: user.email, role: profile.role }, redirectTo }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("login_failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
