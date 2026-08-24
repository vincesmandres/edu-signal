import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to connect to PostgreSQL.");

  pool ??= new Pool({ connectionString: url, max: 5 });
  return drizzle(pool, { schema });
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
