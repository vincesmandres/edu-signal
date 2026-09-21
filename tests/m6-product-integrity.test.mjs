import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateEvaluationScores, validateGlobalScore } from "../lib/evaluation-validation.ts";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("M6 teacher inbox is submitted-only, owned, contextual and ordered", async () => {
  const route = await text("app/api/evidence/route.ts");
  assert.match(route, /eq\(evidences\.status, "submitted"\)/);
  assert.match(route, /eq\(classrooms\.teacherId, user\.id\)/);
  assert.match(route, /desc\(evidences\.submittedAt\)/);
  assert.match(route, /moduleTitle/);
  assert.match(route, /activityTitle/);
});

test("M6 frontend has no legacy evidence POST and exposes loading/error/empty/detail states", async () => {
  const studio = await text("app/evidence/EvidenceStudio.tsx");
  assert.doesNotMatch(studio, /method:\s*["']POST["'][^\n]*api\/evidence/);
  assert.match(studio, /state === "loading"/);
  assert.match(studio, /state === "error"/);
  assert.match(studio, /state === "ready" && !items\.length/);
  assert.match(studio, /\/evidence\/\$\{item\.id\}/);
});

test("M6 detail and download are teacher-authorized and do not expose storage paths", async () => {
  const detail = await text("app/api/evidence/[evidenceId]/route.ts");
  const download = await text("app/api/evidence/[evidenceId]/download/route.ts");
  assert.match(detail, /getApiProfile\("teacher"\)/);
  assert.match(detail, /eq\(classrooms\.teacherId, auth\.profile\.id\)/);
  assert.match(detail, /storageKey: undefined/);
  assert.match(download, /eq\(evidences\.status, "submitted"\)/);
  assert.match(download, /createEvidenceDownloadUrl/);
  assert.match(download, /new Response\(null, \{ status: 302/);
});

test("M6 submitted evidence is immutable and evaluation rejects drafts/foreign/duplicates", async () => {
  const evidence = await text("app/api/evidence/[evidenceId]/route.ts");
  const evaluation = await text("app/api/evaluations/route.ts");
  assert.match(evidence, /La evidencia enviada es inmutable/);
  assert.match(evaluation, /evidence\.evidence\.status !== "submitted"/);
  assert.match(evaluation, /eq\(classrooms\.teacherId, auth\.profile\.id\)/);
  assert.match(evaluation, /status: 409/);
  assert.match(evaluation, /validateEvaluationScores/);
  assert.match(evaluation, /transaction/);
  assert.match(evaluation, /Array\.isArray\(parsed\)/);
  assert.match(evaluation, /evaluación global requiere una puntuación/);
  assert.match(evaluation, /no tiene criterios evaluables/);
  assert.match(evaluation, /auditEvents/);
  assert.match(evaluation, /evaluation\.created/);
});

test("M6 completion enables only after submitted evidence and student submit updates UI", async () => {
  const renderer = await text("components/activities/ActivityRenderer.tsx");
  const completion = await text("app/api/student/activities/[activityId]/complete/route.ts");
  assert.match(renderer, /useState\(completed\)/);
  assert.match(renderer, /setIsCompleted\(true\)/);
  assert.match(renderer, /aria-describedby=\{evidenceBlocked \? blockedHelpId/);
  assert.match(renderer, /onChange\(data\.evidence\)/);
  assert.match(renderer, /fieldset disabled=\{saving\}/);
  assert.match(renderer, /disabled=\{saving\} onClick=\{submit\}/);
  assert.match(completion, /eq\(evidences\.status, "submitted"\)/);
});

test("M6 validators reject ambiguous scores and enforce rubric completeness", () => {
  const criteria = [{ id: "c1", maxScore: "4" }, { id: "c2", maxScore: "4" }];
  assert.equal(validateEvaluationScores([{ criterionId: "c1", score: "2" }, { criterionId: "c2", score: "3.5" }], criteria), null);
  assert.match(validateEvaluationScores([{ criterionId: "c1", score: " " }, { criterionId: "c2", score: "3" }], criteria), /puntuación/);
  assert.match(validateEvaluationScores([{ criterionId: "c1", score: "1e2" }, { criterionId: "c2", score: "3" }], criteria), /puntuación/);
  assert.match(validateEvaluationScores([{ criterionId: "c1", score: 2 }, { criterionId: "c1", score: 3 }], criteria), /duplicados/);
  assert.match(validateEvaluationScores([{ criterionId: "c1", score: 2 }], criteria), /todos/);
  assert.equal(validateGlobalScore("99.5"), null);
  assert.match(validateGlobalScore(""), /puntuación/);
  assert.match(validateGlobalScore("NaN"), /puntuación/);
  assert.match(validateGlobalScore("1e2"), /puntuación/);
});

test("M6 migration makes evaluation uniqueness explicit with duplicate preflight", async () => {
  const migration = await text("drizzle-postgres/0004_m6_evaluation_integrity.sql");
  const schema = await text("db/schema.ts");
  assert.match(migration, /HAVING COUNT\(\*\) > 1/);
  assert.match(migration, /uq_evaluations_evidence/);
  assert.match(schema, /uniqueIndex\("uq_evaluations_evidence"\)\.on\(table\.evidenceId\)/);
});

test("M6 Drizzle snapshot is generated JSON consistent with the schema index", async () => {
  const snapshot = JSON.parse(await text("drizzle-postgres/meta/0004_snapshot.json"));
  assert.equal(snapshot.dialect, "postgresql");
  assert.ok(snapshot.id);
  assert.equal(snapshot.tables["public.evaluations"].indexes.uq_evaluations_evidence.isUnique, true);
  assert.deepEqual(snapshot.tables["public.evaluations"].indexes.uq_evaluations_evidence.columns.map((column) => column.expression), ["evidence_id"]);
});
