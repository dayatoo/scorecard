import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  checkPassword,
  createSessionToken,
  verifySessionToken,
} from "./auth";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
  process.env.APP_PASSWORD = "correct horse battery staple";
});

describe("shared password", () => {
  it("accepts the configured password", async () => {
    assert.equal(await checkPassword("correct horse battery staple"), true);
  });

  it("rejects anything else", async () => {
    assert.equal(await checkPassword("wrong"), false);
    assert.equal(await checkPassword(""), false);
    assert.equal(await checkPassword("correct horse battery stapl"), false);
  });
});

describe("session tokens", () => {
  it("round-trips a freshly issued token", async () => {
    assert.equal(await verifySessionToken(await createSessionToken()), true);
  });

  it("rejects a missing, malformed or tampered token", async () => {
    assert.equal(await verifySessionToken(undefined), false);
    assert.equal(await verifySessionToken(""), false);
    assert.equal(await verifySessionToken("nonsense"), false);

    const token = await createSessionToken();
    const [expiry, signature] = token.split(".");
    // Extending the expiry invalidates the signature over it.
    assert.equal(await verifySessionToken(`${Number(expiry) + 60_000}.${signature}`), false);
  });

  it("rejects an expired token", async () => {
    const issued = new Date("2020-01-01T00:00:00Z");
    const token = await createSessionToken(issued);
    assert.equal(await verifySessionToken(token, new Date("2020-01-02T00:00:00Z")), true);
    assert.equal(await verifySessionToken(token, new Date("2021-01-01T00:00:00Z")), false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = "a-different-secret";
    const valid = await verifySessionToken(token);
    process.env.SESSION_SECRET = "test-secret";
    assert.equal(valid, false);
  });
});
