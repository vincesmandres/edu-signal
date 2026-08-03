import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { sessions } from "../../../../db/schema";
import { clearSessionCookie, SESSION_COOKIE, sha256 } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (cookie) await getDb().delete(sessions).where(eq(sessions.tokenHash, await sha256(decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)))));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store", "set-cookie": clearSessionCookie() } });
}
