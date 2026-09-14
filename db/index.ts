import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type CloudflareBindings = {
  HYPERDRIVE?: { connectionString: string };
};

let client: Sql | undefined;

function getConnection() {
  try {
    const bindings = getCloudflareContext().env as CloudflareBindings;
    if (bindings.HYPERDRIVE?.connectionString) {
      return { url: bindings.HYPERDRIVE.connectionString, prepare: false };
    }
  } catch {
    // Local Node.js requests do not have an OpenNext request context.
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  return { url, prepare: true };
}

export function getDb() {
  if (!client) {
    const connection = getConnection();
    client = postgres(connection.url, { prepare: connection.prepare, max: 5 });
  }
  return drizzle(client, { schema });
}

export async function closeDb() {
  await client?.end({ timeout: 5 });
  client = undefined;
}
