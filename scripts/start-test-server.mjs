import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ app: true, supabase: true, database: true, migration: true, anon: true, password: true, service: true });
const child = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: process.cwd(), env: process.env, stdio: "inherit", detached: process.platform !== "win32", windowsHide: true,
});
child.once("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
