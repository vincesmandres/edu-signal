import { createHash } from "node:crypto";

export function migrationHash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

export function assertMigrationHash(storedHash, contents, name) {
  const hash = migrationHash(contents);
  if (storedHash && storedHash !== hash) throw new Error(`Migration hash mismatch: ${name}`);
  return hash;
}

export async function recordMigration(sql, name, contents) {
  return applyJournaledMigration(sql, name, contents, async () => {});
}

export async function applyJournaledMigration(sql, name, contents, execute) {
  const existing = await sql`select sha256 from public._m62_migration_journal where filename = ${name}`;
  const hash = assertMigrationHash(existing[0]?.sha256, contents, name);
  if (existing.length) return { hash, applied: false };
  await sql.begin(async (tx) => {
    await execute(tx, contents);
    await tx`insert into public._m62_migration_journal (filename, sha256) values (${name}, ${hash})`;
  });
  return { hash, applied: true };
}
