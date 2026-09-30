import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createSessionToken, sessionCookieSecure, signText, verifySessionToken } from "./auth";

before(() => {
  process.env.SESSION_SECRET = "test-secret";
});

const USER_ID = "user_abc123";

describe("session tokens", () => {
  it("round-trips a freshly issued token with its session version", async () => {
    const token = await createSessionToken(USER_ID, 3);
    assert.deepEqual(await verifySessionToken(token), { userId: USER_ID, sessionVersion: 3 });
  });

  it("rejects a missing, malformed or tampered token", async () => {
    assert.equal(await verifySessionToken(undefined), null);
    assert.equal(await verifySessionToken(""), null);
    assert.equal(await verifySessionToken("nonsense"), null);

    const token = await createSessionToken(USER_ID, 0);
    const [userId, version, expiry, signature] = token.split(".");
    // Extending the expiry invalidates the signature over it.
    assert.equal(
      await verifySessionToken(`${userId}.${version}.${Number(expiry) + 60_000}.${signature}`),
      null
    );
    // So does claiming a later session version.
    assert.equal(await verifySessionToken(`${userId}.1.${expiry}.${signature}`), null);
    assert.equal(await verifySessionToken(`${userId}.-1.${expiry}.${signature}`), null);
  });

  it("still accepts a token issued before session versions, as version 0", async () => {
    const expiresAt = Date.now() + 60_000;
    const legacy = `${USER_ID}.${expiresAt}.${await signText(`${USER_ID}.${expiresAt}`)}`;
    assert.deepEqual(await verifySessionToken(legacy), { userId: USER_ID, sessionVersion: 0 });
  });

  it("rejects an expired token", async () => {
    const issued = new Date("2020-01-01T00:00:00Z");
    const token = await createSessionToken(USER_ID, 0, issued);
    assert.deepEqual(
      await verifySessionToken(token, new Date("2020-01-02T00:00:00Z")),
      { userId: USER_ID, sessionVersion: 0 }
    );
    assert.equal(
      await verifySessionToken(token, new Date("2021-01-01T00:00:00Z")),
      null
    );
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(USER_ID, 0);
    process.env.SESSION_SECRET = "a-different-secret";
    const valid = await verifySessionToken(token);
    process.env.SESSION_SECRET = "test-secret";
    assert.equal(valid, null);
  });
});

describe("sessionCookieSecure", () => {
  it("defaults to production only", () => {
    assert.equal(sessionCookieSecure({ NODE_ENV: "production" }), true);
    assert.equal(sessionCookieSecure({ NODE_ENV: "development" }), false);
  });

  it("honours an explicit override either way", () => {
    assert.equal(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "false" }), false);
    assert.equal(sessionCookieSecure({ NODE_ENV: "development", SESSION_COOKIE_SECURE: "true" }), true);
    assert.equal(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "" }), true);
  });
});
