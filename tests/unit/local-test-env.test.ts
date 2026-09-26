import assert from "node:assert/strict";
import test from "node:test";
import { validateLocalDb, validateLocalHttp } from "../../scripts/local-test-env.mjs";

test("local guard accepts only expected loopback endpoints", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.doesNotThrow(() => validateLocalHttp("supabase", `http://${host}:55421`, 55421));
    assert.doesNotThrow(() => validateLocalDb("database", `postgresql://postgres:postgres@${host}:55432/postgres`));
  }
});

test("local guard rejects remote endpoints before use", () => {
  assert.throws(() => validateLocalHttp("supabase", "https://supabase.example.test:55421", 55421), /BLOCKED/);
  assert.throws(() => validateLocalDb("database", "postgresql://user:pass@db.example.test:55432/postgres"), /BLOCKED/);
  assert.throws(() => validateLocalHttp("app", "http://127.0.0.1:3001", 3000), /BLOCKED/);
});
