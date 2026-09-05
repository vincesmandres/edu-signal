import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("M5 evidence schema is canonical and separate from responses", async () => {
  const schema = await text("db/schema.ts");
  assert.match(schema, /moduleId: text\("module_id"\)/); assert.match(schema, /activityId: text\("activity_id"\)/);
  assert.match(schema, /evidenceType: text\("evidence_type"\)/); assert.match(schema, /textContent: text\("text_content"\)/);
  assert.match(schema, /externalUrl: text\("external_url"\)/); assert.match(schema, /status: text\("status"\).*default\("draft"\)/s);
  assert.match(schema, /uniqueIndex\("uq_evidences_student_activity"/);
});
test("M5 routes enforce student ownership and immutable submission", async () => {
  const [create, detail, submit, complete] = await Promise.all([text("app/api/student/evidence/route.ts"), text("app/api/student/evidence/[evidenceId]/route.ts"), text("app/api/student/evidence/[evidenceId]/submit/route.ts"), text("app/api/student/activities/[activityId]/complete/route.ts")]);
  assert.match(create, /requireStudent/); assert.match(create, /student\.id/); assert.match(detail, /status !== "draft"/); assert.match(submit, /status: "submitted"/); assert.match(complete, /requiresEvidence/);
});
test("M5 file and link validation is centralized", async () => {
  const source = await text("lib/evidence.ts"); const migration = await text("supabase/migrations/0007_m5_evidence_system.sql");
  assert.match(source, /MAX_EVIDENCE_FILE_SIZE/); assert.match(source, /file\.size === 0/); assert.match(source, /url\.protocol === "https:"/); assert.match(source, /safeEvidenceFilename/);
  assert.match(migration, /students_read_own_evidence/); assert.match(migration, /teachers_read_submitted_owned_evidence/); assert.match(migration, /storage\.objects/);
});
test("M5 policies are rerunnable and cannot promote drafts through direct RLS updates", async () => {
  const migration = await text("supabase/migrations/0007_m5_evidence_system.sql");
  assert.match(migration, /drop policy if exists "students_update_own_draft_evidence"/);
  assert.match(migration, /with check \(status = 'draft'/);
  assert.match(migration, /submitted evidence is immutable/);
});
test("M5 legacy writes are isolated and teacher downloads are authorized", async () => {
  const [legacy, upload, download] = await Promise.all([text("app/api/evidence/route.ts"), text("app/api/evidence/upload/route.ts"), text("app/api/evidence/[evidenceId]/download/route.ts")]);
  assert.match(legacy, /status: 410/);
  assert.match(upload, /status: 410/);
  assert.match(download, /getApiProfile\("teacher"\)/);
  assert.match(download, /status, "submitted"/);
});
test("M5 draft updates support validated evidence type changes and upload compensation", async () => {
  const [detail, file] = await Promise.all([text("app/api/student/evidence/[evidenceId]/route.ts"), text("app/api/student/evidence/[evidenceId]/file/route.ts")]);
  assert.match(detail, /body\.evidenceType/);
  assert.match(detail, /eq\(evidences\.status, "draft"\)/);
  assert.match(file, /file_upload_rollback/);
  assert.match(file, /file_uploaded/);
  assert.match(file, /best effort database compensation/);
});
