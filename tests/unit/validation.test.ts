import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEvidenceContent,
  validateEvidenceFile,
  validateEvidenceType,
  validateExternalUrl,
  safeEvidenceFilename,
} from "../../lib/evidence";
import { activeEnrollment, rubricMatchesClassroom, studentOwnsEvidence, teacherOwnsClassroom } from "../../lib/authorization/policy";
import { validateEvaluationScores, validateGlobalScore } from "../../lib/evaluation-validation";

test("evidence type and content validators enforce each content contract", () => {
  assert.equal(validateEvidenceType("text"), true);
  assert.equal(validateEvidenceType("video"), false);
  assert.equal(validateEvidenceContent({ evidenceType: "text", textContent: "  " }), "El texto de la evidencia es obligatorio.");
  assert.equal(validateEvidenceContent({ evidenceType: "link", externalUrl: "http://example.test" }), "La URL debe ser HTTPS válida.");
  assert.equal(validateEvidenceContent({ evidenceType: "file" }), "Debes subir un archivo antes de enviar.");
  assert.equal(validateEvidenceContent({ evidenceType: "text", textContent: "ok" }), null);
  assert.equal(validateExternalUrl(" https://example.test/a "), "https://example.test/a");
  assert.equal(validateExternalUrl("javascript:alert(1)"), null);
});

test("file validation checks size, MIME and extension", () => {
  assert.equal(validateEvidenceFile(new File(["pdf"], "work.pdf", { type: "application/pdf" })), null);
  assert.match(validateEvidenceFile(new File([], "empty.pdf", { type: "application/pdf" }))!, /vacío/);
  assert.match(validateEvidenceFile(new File(["x"], "work.exe", { type: "application/pdf" }))!, /extensión/);
  assert.match(validateEvidenceFile(new File(["x"], "work.pdf", { type: "application/zip" }))!, /Tipo/);
});

test("filenames are path-safe and bounded without trusting regex-only authorization", () => {
  assert.equal(safeEvidenceFilename("../secret\\report final.pdf"), "_secret_report_final.pdf");
  assert.equal(safeEvidenceFilename("..."), "evidence-file");
  assert.ok(safeEvidenceFilename("x".repeat(200)).length <= 120);
});

test("authorization policies deny cross-tenant and inactive access", () => {
  assert.equal(teacherOwnsClassroom("teacher-a", "teacher-a"), true);
  assert.equal(teacherOwnsClassroom("teacher-a", "teacher-b"), false);
  assert.equal(activeEnrollment("active"), true);
  assert.equal(activeEnrollment("inactive"), false);
  assert.equal(studentOwnsEvidence("student-a", "student-a", "active"), true);
  assert.equal(studentOwnsEvidence("student-a", "student-b", "active"), false);
  assert.equal(rubricMatchesClassroom("class-a", "class-b", true), false);
});

test("evaluation scores require complete rubric and bounded global score", () => {
  const criteria = [{ id: "a", maxScore: "4" }, { id: "b", maxScore: "10" }];
  assert.equal(validateEvaluationScores([{ criterionId: "a", score: 4 }, { criterionId: "b", score: "9.5" }], criteria), null);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 4 }], criteria)!, /todos/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 5 }, { criterionId: "b", score: 1 }], criteria)!, /rango/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: 1 }, { criterionId: "a", score: 2 }], criteria)!, /duplicados/);
  assert.match(validateEvaluationScores([{ criterionId: "a", score: "1e2" }, { criterionId: "b", score: 1 }], criteria)!, /puntuación/);
  assert.equal(validateGlobalScore("99.5"), null);
  assert.match(validateGlobalScore("101")!, /entre 0 y 100/);
});
