import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { assertLocalTestEnv, loadLocalEnv, refreshFixtureEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ app: true, supabase: true, database: true, migration: true, service: true, anon: true, password: true });

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? 1}`);
}

try {
  run("npm", ["run", "supabase:bootstrap"]);
  run("npm", ["run", "supabase:bootstrap:idempotent"]);
  run("npm", ["run", "test:migrations"]);
  run("npm", ["run", "test:remote-guards"]);
  run("npm", ["run", "test:preflight"]);
  run("npm", ["run", "supabase:fixtures"]);
  refreshFixtureEnv();
  run("npm", ["run", "typecheck"]);
  run("npm", ["run", "lint"]);
  run("npm", ["run", "test:static"]);
  run("npm", ["run", "test:unit"]);
  run("npm", ["run", "build"]);
  run("npm", ["run", "test:api"]);
  run("npm", ["run", "test:db"]);
  run("npm", ["run", "test:rls"]);
  run("npm", ["run", "test:e2e"]);
  run("npm", ["audit", "--omit=dev", "--audit-level=high"]);
  run("git", ["diff", "--check"]);
  console.log("VERIFY LOCAL PASS: clean bootstrap, same-state idempotence/hash gate, all M6.2 layers and runtime audit passed.");
} finally {
  await rm("test-results", { recursive: true, force: true });
  spawnSync("npm", ["run", "supabase:cleanup"], { stdio: "ignore", shell: process.platform === "win32", windowsHide: true });
}
