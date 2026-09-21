import test from "node:test";
import assert from "node:assert/strict";
import { validateEvaluationScores } from "../lib/evaluation-validation.ts";
import { activeEnrollment, rubricMatchesClassroom, studentOwnsEvidence, teacherOwnsClassroom } from "../lib/authorization/policy.ts";
import { createEvidenceStoragePath } from "../lib/storage/evidence-path.ts";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");

test("M6.1 Teacher A/B isolation is deny-by-default", () => {
  assert.equal(teacherOwnsClassroom("teacher-a", "teacher-a"), true);
  assert.equal(teacherOwnsClassroom("teacher-a", "teacher-b"), false);
  assert.equal(rubricMatchesClassroom("class-a", "class-a", true), true);
  assert.equal(rubricMatchesClassroom("class-b", "class-a", true), false);
  assert.equal(rubricMatchesClassroom("class-a", "class-a", false), false);
});

test("M6.1 Student A/B evidence requires identity and active enrollment", () => {
  assert.equal(activeEnrollment("active"), true);
  assert.equal(activeEnrollment("inactive"), false);
  assert.equal(studentOwnsEvidence("student-a", "student-a", "active"), true);
  assert.equal(studentOwnsEvidence("student-a", "student-b", "active"), false);
  assert.equal(studentOwnsEvidence("student-a", "student-a", "inactive"), false);
});

test("M6.1 scores reject missing, extra, duplicate and out-of-range criteria", () => {
  const criteria = [{ id: "a", maxScore: "4" }, { id: "b", maxScore: "10" }];
  assert.equal(validateEvaluationScores([{ criterionId: "a", score: "4" }, { criterionId: "b", score: 10 }], criteria), null);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 2 }], criteria), /todos/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 2 }, { criterionId: "a", score: 3 }, { criterionId: "b", score: 2 }], criteria), /duplicados/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 5 }, { criterionId: "b", score: 2 }], criteria), /rango/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 2 }, { criterionId: "b-extra", score: 2 }], criteria), /rúbrica/);
  assert.match(validateEvaluationScores([null], criteria), /objeto/);
});

test("M6.1 final writes retain ownership, enrollment and draft predicates", async () => {
  const [detail, file, submit, credential, evaluation] = await Promise.all([
    text("app/api/student/evidence/[evidenceId]/route.ts"),
    text("app/api/student/evidence/[evidenceId]/file/route.ts"),
    text("app/api/student/evidence/[evidenceId]/submit/route.ts"),
    text("app/api/credentials/route.ts"),
    text("app/api/evaluations/route.ts"),
  ]);
  assert.match(detail, /lockStudentDraftEvidence/); assert.match(detail, /evidences\.studentId/); assert.match(detail, /evidences\.status, "draft"/);
  assert.match(file, /lockStudentDraftEvidence/); assert.match(file, /deleteEvidenceFile\(path\)/); assert.match(file, /FormData inválido/); assert.match(file, /createEvidenceStoragePath/);
  assert.match(submit, /lockStudentDraftEvidence/); assert.match(submit, /evidences\.status, "draft"/);
  assert.match(credential, /for\("update"\)/); assert.match(credential, /db\.transaction/);
  assert.match(evaluation, /currentEvidence/); assert.match(evaluation, /for\("update"\)/); assert.match(evaluation, /transactionScoreError/);
});

test("M6.1 public evidence DTOs redact storage paths and malformed JSON is handled", async () => {
  const [dto, studentCreate, studentDetail, studentFile, studentDownload] = await Promise.all([
    text("lib/evidence-dto.ts"), text("app/api/student/evidence/route.ts"), text("app/api/student/evidence/[evidenceId]/route.ts"), text("app/api/student/evidence/[evidenceId]/file/route.ts"), text("app/api/student/evidence/[evidenceId]/download/route.ts"),
  ]);
  assert.match(dto, /storageKey, \.\.\.safe/);
  assert.match(studentCreate, /toEvidenceDto/); assert.match(studentDetail, /toEvidenceDto/); assert.match(studentFile, /toEvidenceDto/);
  assert.match(studentDetail, /JSON inválido/); assert.match(studentFile, /FormData inválido/); assert.match(studentDownload, /No se pudo preparar la descarga/);
});

test("M6.1 upload attempts use unique paths and own-object cleanup", async () => {
  const first = createEvidenceStoragePath("class-a", "student-a", "evidence-1", "same name.pdf");
  const second = createEvidenceStoragePath("class-a", "student-a", "evidence-1", "same name.pdf");
  assert.notEqual(first, second);
  assert.match(first, /^class-a\/student-a\/evidence-1\/[0-9a-f-]+\/same_name\.pdf$/);
  assert.match(second, /^class-a\/student-a\/evidence-1\/[0-9a-f-]+\/same_name\.pdf$/);
  const fileRoute = await text("app/api/student/evidence/[evidenceId]/file/route.ts");
  const storage = await text("lib/storage/evidence-storage.ts");
  assert.match(fileRoute, /deleteEvidenceFile\(path\)/);
  assert.match(fileRoute, /cleanupEvidenceFileIfUnreferenced\(evidence\.evidence\.storageKey\)/);
  assert.match(storage, /eq\(evidences\.storageKey, path\)/);
  assert.match(storage, /evidence_storage_cleanup_failed/);
  assert.doesNotMatch(storage, /console\.error\([^\n]*path/);
});

test("M6.1 evidence creation locks enrollment and revalidates context transactionally", async () => {
  const [route, auth] = await Promise.all([text("app/api/student/evidence/route.ts"), text("lib/authorization/index.ts")]);
  assert.match(route, /db\.transaction/);
  assert.match(route, /lockActiveEnrollment\(tx, student\.id, context\.classroom\.id\)/);
  assert.match(route, /currentContext/);
  assert.match(route, /\.for\("update"\)/);
  assert.match(route, /code === "23505"/);
  assert.match(route, /status: 409/);
  assert.match(auth, /export async function lockActiveEnrollment/);
  assert.match(auth, /eq\(enrollments\.studentId, studentId\)/);
  assert.match(auth, /eq\(enrollments\.classroomId, classroomId\)/);
});
