import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, parseCsv } from "../../lib/csv";

test("CSV parsing supports quoted fields and rejects unterminated values", () => {
  assert.deepEqual(parseCsv('a,b\n"x,y","said ""hi"""\n'), [["a", "b"], ["x,y", 'said "hi"']]);
  assert.equal(csvCell("x,y"), '"x,y"');
  assert.throws(() => parseCsv('a,"b'));
});
