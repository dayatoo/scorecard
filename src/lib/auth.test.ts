import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createSessionToken, verifySessionToken } from "./auth";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
});

const USER_ID = "user_abc123";

describe("session tokens", () => {
  it("round-trips a freshly issued token", async () => {
    const token = await createSessionToken(USER_ID);
    assert.deepEqual(await verifySessionToken(token), { userId: USER_ID });
  });

  it("rejects a missing, malformed or tampered token", async () => {
    assert.equal(await verifySessionToken(undefined), null);
    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("nonsense"), null);

    const token = await createSessionToken(USER_ID);
    const [userId, expiry, signature] = token.split(".");
    // Extending the expiry invalidates the signature over it.
    assert.equal(
      await verifySessionToken(`${userId}.${Number(expiry) + 60_000}.${signature}`),
      null
    );
  });

  it("rejects an expired token", async () => {
    const issued = new Date("2020-01-01T00:00:00Z");
    const token = await createSessionToken(USER_ID, issued);
    assert.deepEqual(
      await verifySessionToken(token, new Date("2020-01-02T00:00:00Z")),
      { userId: USER_ID }
    );
    assert.equal(
      await verifySessionToken(token, new Date("2021-01-01T00:00:00Z")),
      null
    );
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(USER_ID);
    process.env.SESSION_SECRET = "a-different-secret";
    const valid = await verifySessionToken(token);
    process.env.SESSION_SECRET = "test-secret";
    assert.equal(valid, null);
  });
});
