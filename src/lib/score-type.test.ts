import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreTypesOf } from "./score-type";

describe("scoreTypesOf", () => {
  it("tags an actual, non-prorated row as ACTUAL only", () => {
    assert.deepEqual(scoreTypesOf({ provisional: false, prorated: false }), ["ACTUAL"]);
  });

  it("tags an estimate row as ESTIMATE only", () => {
    assert.deepEqual(scoreTypesOf({ provisional: true, prorated: false }), ["ESTIMATE"]);
  });

  it("adds PRORATED alongside whichever of ACTUAL/ESTIMATE applies", () => {
    assert.deepEqual(scoreTypesOf({ provisional: false, prorated: true }), ["ACTUAL", "PRORATED"]);
    assert.deepEqual(scoreTypesOf({ provisional: true, prorated: true }), ["ESTIMATE", "PRORATED"]);
  });
});
