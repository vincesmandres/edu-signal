import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { applyJournaledMigration } from "./migration-journal.mjs";
import { assertLocalTestEnv, loadLocalEnv } from "./local-test-env.mjs";

loadLocalEnv();
assertLocalTestEnv({ supabase: true, database: true, migration: true });
const sql = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1 });
const suffix = randomUUID().replaceAll("-", "");
const filename = `__m62_hash_gate_${suffix}.sql`;
const table = `__m62_hash_gate_${suffix}`;
const original = `create table public.${table} (id text primary key);`;
const changed = `create table public.${table} (id text primary key, changed boolean);`;
let journalized = false;
let executedAfterMismatch = false;
try {
  await applyJournaledMigration(sql, filename, original, async (tx, contents) => { await tx.unsafe(contents); });
  journalized = (await sql`select filename from public._m62_migration_journal where filename = ${filename}`).length === 1;
  if (!journalized) throw new Error("Temporary migration was not journalized in the real journal table.");
  try {
    await applyJournaledMigration(sql, filename, changed, async () => { executedAfterMismatch = true; });
    throw new Error("Changed migration unexpectedly passed SHA256 gate.");
  } catch (error) {
    if (!(error instanceof Error) || !/Migration hash mismatch/.test(error.message)) throw error;
  }
  if (executedAfterMismatch) throw new Error("Migration mismatch was detected after SQL execution.");
  console.log("MIGRATION HASH GATE PASS: real journal row existed, changed filename rejected before SQL, cleanup pending.");
} finally {
  await sql.begin(async (tx) => {
    await tx.unsafe(`drop table if exists public."${table}"`);
    await tx`delete from public._m62_migration_journal where filename = ${filename}`;
  }).catch(async () => {
    await sql.unsafe(`drop table if exists public."${table.replaceAll('"', '""')}"`);
    await sql`delete from public._m62_migration_journal where filename = ${filename}`;
  });
  const remaining = await sql`select filename from public._m62_migration_journal where filename = ${filename}`;
  if (remaining.length) throw new Error("Temporary migration journal row survived cleanup.");
  await sql.end();
}
