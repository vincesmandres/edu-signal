import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { credentials } from "../../../../../db/schema";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const rows = await getDb().select({ credential: credentials }).from(credentials).where(eq(credentials.verificationCode, code)).limit(1);
  if (!rows.length) return Response.json({ valid: false, error: "Credencial no encontrada." }, { status: 404, headers: { "cache-control": "no-store" } });
  const credential = rows[0].credential;
  return Response.json({ valid: credential.status === "issued", credential: JSON.parse(credential.credentialJson), issuedAt: credential.issuedAt }, { headers: { "cache-control": "no-store" } });
}
