import assert from "node:assert/strict";
import test from "node:test";
import { denormalizeGrade, normalizeGrade } from "../../lib/grades";

test("grade normalization covers configured numeric scales and boundaries", () => {
  const scale5 = { type: "numeric_5" as const, min: 0, max: 5, passThreshold: 3 };
  const scale10 = { type: "numeric_10" as const, min: 0, max: 10, passThreshold: 6 };
  assert.equal(normalizeGrade(0, scale5), 0);
  assert.equal(normalizeGrade(5, scale5), 100);
  assert.equal(normalizeGrade(7.25, scale10), 72.5);
  assert.equal(denormalizeGrade(72.5, scale10), 7.25);
  assert.throws(() => normalizeGrade(11, scale10), /grade_out_of_range/);
});
