import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test:55421",
  SUPABASE_URL: "https://supabase.example.test:55421",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fake-anon",
  SUPABASE_ANON_KEY: "fake-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fake-service",
  DATABASE_URL: "postgresql://fake:fake@db.example.test:55432/postgres",
  MIGRATION_DATABASE_URL: "postgresql://fake:fake@db.example.test:55432/postgres",
  E2E_TEST_USER_PASSWORD: "fake-password",
  E2E_BASE_URL: "http://127.0.0.1:3000",
  TEST_API_BASE_URL: "http://127.0.0.1:3100",
};
const tsx = "node_modules/tsx/dist/cli.mjs";
const commands = [
  ["bootstrap", process.execPath, ["scripts/supabase-bootstrap.mjs"]],
  ["cleanup", process.execPath, ["scripts/supabase-cleanup.mjs"]],
  ["start-test-server", process.execPath, ["scripts/start-test-server.mjs"]],
  ["seed-fixtures", process.execPath, [tsx, "scripts/seed-test-fixtures.ts"]],
  ["test-preflight", process.execPath, [tsx, "scripts/test-preflight.ts"]],
  ["test-db", process.execPath, [tsx, "scripts/test-db.ts"]],
  ["test-rls", process.execPath, [tsx, "scripts/test-rls.ts"]],
  ["test-api", process.execPath, [tsx, "tests/api.integration.ts"]],
  ["test-migration-gate", process.execPath, ["scripts/test-migration-gate.mjs"]],
  ["global-setup", process.execPath, [tsx, "-e", "import setup from './tests/e2e/global-setup.ts'; await setup();"]],
  ["verify-local", process.execPath, ["scripts/verify-local.mjs"]],
];
for (const [name, command, args] of commands) {
  const started = Date.now();
  const result = spawnSync(command, args, { env, stdio: "ignore", shell: process.platform === "win32", windowsHide: true, timeout: 10_000 });
  if (result.status === 0 || result.error?.code === "ETIMEDOUT" || Date.now() - started > 10_000) throw new Error(`Remote guard failed for ${name}: entrypoint did not fail fast.`);
}
console.log(`REMOTE GUARDS PASS: ${commands.length} destructive/authenticated entrypoints rejected remote URLs before connection.`);
