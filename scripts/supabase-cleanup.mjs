import { spawnSync } from "node:child_process";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";
loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true });
const result = spawnSync("supabase", ["stop", "--no-backup"], { stdio: "ignore", shell: process.platform === "win32", windowsHide: true });
process.exit(result.status ?? 1);
