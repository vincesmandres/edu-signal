import { sql } from "drizzle-orm";
import { getDb } from "../../../db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "connected" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("health_database_failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ status: "error", database: "disconnected" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
