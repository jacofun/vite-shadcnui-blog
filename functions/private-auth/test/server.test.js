import assert from "node:assert/strict";
import test from "node:test";

import { createWebServer } from "../server.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("web server maps HTTP requests, FC credentials and responses", async () => {
  let received;
  const server = createWebServer({
    handler: async (request) => {
      received = request;
      return {
        statusCode: 201,
        headers: { "content-type": "application/json", "set-cookie": "session=test; Secure" },
        body: JSON.stringify({ ok: true }),
      };
    },
  });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/private-auth/health?test=1`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fc-access-key-id": "test-id",
        "x-fc-access-key-secret": "test-secret",
        "x-fc-security-token": "test-token",
      },
      body: JSON.stringify({ ping: true }),
    });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("set-cookie"), "session=test; Secure");
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(received.method, "POST");
    assert.equal(received.path, "/api/private-auth/health");
    assert.equal(received.body, JSON.stringify({ ping: true }));
    assert.deepEqual(received.credentials, {
      accessKeyId: "test-id",
      accessKeySecret: "test-secret",
      securityToken: "test-token",
    });
  } finally {
    await close(server);
  }
});

test("web server rejects request bodies larger than 128 KiB", async () => {
  let called = false;
  const server = createWebServer({ handler: async () => {
    called = true;
    throw new Error("handler must not run");
  } });
  const port = await listen(server);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/private-auth/health`, {
      method: "POST",
      body: "x".repeat(128 * 1024 + 1),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "REQUEST_TOO_LARGE");
    assert.equal(called, false);
  } finally {
    await close(server);
  }
});
