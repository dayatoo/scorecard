import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  companyIdProblem,
  generateTemporaryPassword,
  passwordProblem,
  usernameProblem,
} from "./accounts";

describe("usernameProblem", () => {
  it("accepts ordinary usernames", () => {
    assert.equal(usernameProblem("admin"), null);
    assert.equal(usernameProblem("finance.member"), null);
    assert.equal(usernameProblem("a_b-c.9"), null);
  });

  it("rejects too short, too long or unusual characters", () => {
    assert.match(usernameProblem("ab") ?? "", /3–32/);
    assert.match(usernameProblem("x".repeat(33)) ?? "", /3–32/);
    assert.match(usernameProblem("has space") ?? "", /letters, numbers/);
    assert.match(usernameProblem("<script>") ?? "", /letters, numbers/);
  });
});

describe("companyIdProblem", () => {
  it("accepts typical ID formats and rejects others", () => {
    assert.equal(companyIdProblem("EMP-0001"), null);
    assert.equal(companyIdProblem("HR/2024/17"), null);
    assert.notEqual(companyIdProblem(""), null);
    assert.notEqual(companyIdProblem("x".repeat(33)), null);
    assert.notEqual(companyIdProblem("EMP 1"), null);
  });
});

describe("passwordProblem", () => {
  it("enforces the minimum length and bcrypt's 72-byte limit", () => {
    assert.equal(passwordProblem("password123"), null);
    assert.match(passwordProblem("short") ?? "", /at least 8/);
    assert.equal(passwordProblem("x".repeat(72)), null);
    assert.match(passwordProblem("x".repeat(73)) ?? "", /72 bytes/);
    // Multi-byte characters count by bytes, not characters.
    assert.match(passwordProblem("é".repeat(40)) ?? "", /72 bytes/);
  });
});

describe("generateTemporaryPassword", () => {
  it("produces three groups of four unambiguous characters", () => {
    const password = generateTemporaryPassword();
    assert.match(password, /^[a-hjkmnp-zA-HJ-NP-Z2-9]{4}-[a-hjkmnp-zA-HJ-NP-Z2-9]{4}-[a-hjkmnp-zA-HJ-NP-Z2-9]{4}$/);
    assert.equal(passwordProblem(password), null);
  });

  it("differs between calls", () => {
    const seen = new Set(Array.from({ length: 50 }, generateTemporaryPassword));
    assert.equal(seen.size, 50);
  });
});
