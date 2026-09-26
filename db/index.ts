import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type CloudflareBindings = {
  HYPERDRIVE?: { connectionString: string };
};

let client: Sql | undefined;
const requestClients = new WeakMap<object, Sql>();

function getConnection() {
  try {
    const context = getCloudflareContext();
    const bindings = context.env as CloudflareBindings;
    if (bindings.HYPERDRIVE?.connectionString) {
      return { url: bindings.HYPERDRIVE.connectionString, prepare: false, context: context.ctx as object };
    }
  } catch {
    // Local Node.js requests do not have an OpenNext request context.
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
  return { url, prepare: true, context: undefined };
}

export function getDb() {
  const connection = getConnection();
  let activeClient = connection.context ? requestClients.get(connection.context) : client;
  if (!activeClient) {
    activeClient = postgres(connection.url, {
      prepare: connection.prepare,
      fetch_types: connection.context ? false : true,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 5,
      max_lifetime: 30,
      keep_alive: 5,
    });
    if (connection.context) requestClients.set(connection.context, activeClient);
    else client = activeClient;
  }
  return drizzle(activeClient, { schema });
}

export async function closeDb() {
  await client?.end({ timeout: 5 });
  client = undefined;
}
