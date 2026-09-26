import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertLocalTestEnv, loadLocalEnv } from "../../scripts/local-test-env.mjs";

const execFileAsync = promisify(execFile);

export default async function globalSetup() {
  loadLocalEnv();
  assertLocalTestEnv({ app: true, supabase: true, database: true, migration: true, service: true, anon: true, password: true });
  await execFileAsync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/seed-test-fixtures.ts"], {
    cwd: process.cwd(), env: process.env, windowsHide: true, timeout: 90_000,
    maxBuffer: 1_024 * 1_024,
  });
}
