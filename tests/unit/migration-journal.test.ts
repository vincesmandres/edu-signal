import assert from "node:assert/strict";
import test from "node:test";
import { assertMigrationHash, migrationHash } from "../../scripts/migration-journal.mjs";

test("migration journal hash changes when a migration changes", () => {
  const original = migrationHash("create table example (id text);");
  const changed = migrationHash("create table example (id text, label text);");
  assert.notEqual(original, changed);
  assert.equal(migrationHash("create table example (id text);"), original);
  assert.throws(() => assertMigrationHash(original, "changed", "example.sql"), /Migration hash mismatch/);
});
