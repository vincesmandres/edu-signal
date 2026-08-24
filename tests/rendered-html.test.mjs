import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("native Next build produces the Vercel output", async () => {
  await access(new URL(".next", root));
  const packageJson = await readFile(new URL("package.json", root), "utf8");
  assert.match(packageJson, /"build":\s*"next build"/);
  assert.doesNotMatch(packageJson, /vinext build/);
});

test("runtime has no active Cloudflare imports", async () => {
  const [upload, ai, database, storage] = await Promise.all([
    readFile(new URL("app/api/evidence/upload/route.ts", root), "utf8"),
    readFile(new URL("app/api/ai/module/route.ts", root), "utf8"),
    readFile(new URL("db/index.ts", root), "utf8"),
    readFile(new URL("lib/storage/evidence-storage.ts", root), "utf8"),
  ]);
  assert.doesNotMatch(upload, /cloudflare:workers|EVIDENCE_BUCKET/);
  assert.doesNotMatch(ai, /cloudflare:workers|env\.AI/);
  assert.doesNotMatch(database, /drizzle-orm\/d1|env\.DB/);
  assert.match(storage, /storage\.from\(BUCKET\)/);
  assert.match(storage, /createAdminClient/);
});
