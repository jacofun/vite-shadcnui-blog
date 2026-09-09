import assert from "node:assert/strict";
import test from "node:test";

import { createHttpServer } from "../server.js";

test("web runtime relays assistant deltas as server-sent events", async (context) => {
  const server = createHttpServer({
    env: { WEBAUTHN_ORIGIN: "https://yanxiao.me" },
    createHandlerImpl: ({ onAssistantDelta }) => async () => {
      onAssistantDelta("First ");
      onAssistantDelta("answer");
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: "First answer", model: "qwen-test" }),
      };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/private-auth/assessment/ask`, {
    method: "POST",
    body: "{}",
  });
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/u);
  assert.ok(body.includes('event: delta\ndata: {"delta":"First "}'));
  assert.ok(body.includes('event: delta\ndata: {"delta":"answer"}'));
  assert.ok(body.includes('event: done\ndata: {"model":"qwen-test"}'));
});
