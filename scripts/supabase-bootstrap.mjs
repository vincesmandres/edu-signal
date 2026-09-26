import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { applyJournaledMigration } from "./migration-journal.mjs";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true });
const dbUrl = process.env.MIGRATION_DATABASE_URL;
const run = (command, args, quiet = false) => {
  const result = spawnSync(command, args, { stdio: quiet ? "ignore" : "inherit", shell: process.platform === "win32", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with status ${result.status ?? 1}`);
};

// Stop only this configured local project. Start from an isolated, migration-free
// CLI workdir so Drizzle can create the relational schema before Supabase policies.
const idempotence = process.argv.includes("--idempotent");
let isolated;
let sql;
try {
  if (!idempotence) {
    run("supabase", ["stop", "--no-backup"], true);
    isolated = await mkdtemp(join(tmpdir(), "edu-signal-supabase-"));
    await mkdir(join(isolated, "supabase", "migrations"), { recursive: true });
    await cp("supabase/config.toml", join(isolated, "supabase", "config.toml"));
    run("supabase", ["start", "--workdir", isolated], true);
  }
  sql = postgres(dbUrl, { max: 1 });
  await sql`create table if not exists public._m62_migration_journal (filename text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
  const drizzle = (await readdir("drizzle-postgres")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  const supabase = (await readdir("supabase/migrations")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of drizzle) {
    const contents = await readFile(`drizzle-postgres/${name}`, "utf8");
    await applyJournaledMigration(sql, name, contents, async (tx, migration) => { await tx.unsafe(migration); });
  }
  for (const name of supabase) {
    const contents = await readFile(`supabase/migrations/${name}`, "utf8");
    await applyJournaledMigration(sql, name, contents, async (tx, migration) => { await tx.unsafe(migration); });
  }
  console.log(`BOOTSTRAP ${idempotence ? "IDEMPOTENCE" : "CLEAN"} PASS: ${supabase.length} Supabase migrations and ${drizzle.length} Drizzle migrations journaled.`);
} finally { if (sql) await sql.end(); if (isolated) await rm(isolated, { recursive: true, force: true }); }
