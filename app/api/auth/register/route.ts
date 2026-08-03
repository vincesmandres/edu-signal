import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { educators, sessions } from "../../../../db/schema";
import { createSessionToken, hashPassword, sessionCookie, sha256, SESSION_DAYS } from "../../../chatgpt-auth";
import { recordAudit } from "../../../audit";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { displayName?: string; email?: string; password?: string };
    const displayName = body.displayName?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!displayName || !email || !body.password || body.password.length < 8) return Response.json({ error: "Nombre, correo y una contraseña de al menos 8 caracteres son obligatorios." }, { status: 400 });
    const db = getDb();
    const existing = await db.select({ id: educators.id }).from(educators).where(eq(educators.email, email)).limit(1);
    if (existing.length) return Response.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    const educatorId = crypto.randomUUID();
    await db.insert(educators).values({ id: educatorId, displayName, email, passwordHash: await hashPassword(body.password) });
    const token = createSessionToken();
    await db.insert(sessions).values({ id: crypto.randomUUID(), educatorId, tokenHash: await sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() });
    await recordAudit({ actorId: educatorId, action: "account.created", entityType: "educator", entityId: educatorId });
    return new Response(JSON.stringify({ user: { id: educatorId, displayName, email } }), { status: 201, headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": sessionCookie(token) } });
  } catch (error) {
    console.error("registration_failed", error);
    return Response.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
