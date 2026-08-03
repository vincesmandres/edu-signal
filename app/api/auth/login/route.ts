import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { educators, sessions } from "../../../../db/schema";
import { createSessionToken, sessionCookie, sha256, SESSION_DAYS, verifyPassword } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) return Response.json({ error: "Correo y contraseña son obligatorios." }, { status: 400 });
  const db = getDb();
  const rows = await db.select().from(educators).where(eq(educators.email, email)).limit(1);
  const educator = rows[0];
  if (!educator?.passwordHash || !(await verifyPassword(body.password, educator.passwordHash))) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  const token = createSessionToken();
  await db.insert(sessions).values({ id: crypto.randomUUID(), educatorId: educator.id, tokenHash: await sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000).toISOString() });
  return new Response(JSON.stringify({ user: { id: educator.id, displayName: educator.displayName, email: educator.email, role: educator.role } }), { headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": sessionCookie(token) } });
}
