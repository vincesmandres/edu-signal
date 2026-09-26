import { execFileSync } from "node:child_process";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();

function blocked(message: string): never {
  console.error(`BLOCKED: ${message}`);
  process.exit(2);
}

try { assertLocalTestEnv({ app: true, supabase: true, database: true, migration: true, service: true, anon: true, password: true }); } catch (error) { blocked(error instanceof Error ? error.message.replace(/^BLOCKED:\s*/, "") : "invalid local test environment"); }

try {
  execFileSync("docker", ["info"], { stdio: "ignore", timeout: 15_000, windowsHide: true });
  const status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", timeout: 30_000, windowsHide: true });
  const api = status.match(/^API_URL="?([^"\r\n]+)"?/m)?.[1] ?? "";
  const db = status.match(/^DB_URL="?([^"\r\n]+)"?/m)?.[1] ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost):\d+$/i.test(api) || !/^postgres(?:ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\//i.test(db)) blocked("Supabase status is not local; refusing remote integration tests.");
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== api || process.env.DATABASE_URL !== db) blocked("Configured test URLs do not match local Supabase status.");
  const health = await fetch(`${api}/auth/v1/health`, { signal: AbortSignal.timeout(10_000) });
  if (!health.ok) blocked("Local Supabase Auth health check failed.");
} catch {
  blocked("Docker daemon and healthy local Supabase are required.");
}

console.log("TEST PREFLIGHT PASS: Docker, local Supabase and required non-remote test configuration are available.");
