import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Compile the actual browser uploader; only diagnostic logging is stubbed.
const source = await readFile(new URL("../src/lib/privateResourceUpload.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('"@/lib/privatePerformance"', '"data:text/javascript,export function logPrivatePerformance() {}"');
const { uploadPrivateResourceFile } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function setup(t, send) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const originals = { window: globalThis.window, xhr: globalThis.XMLHttpRequest };
  const requests = [];
  globalThis.window = globalThis;
  globalThis.XMLHttpRequest = class extends EventTarget {
    upload = new EventTarget();
    status = 0;
    constructor() { super(); requests.push(this); }
    open() {}
    setRequestHeader() {}
    send() { send?.(this, requests.length); }
    abort() { this.dispatchEvent(new Event("abort")); }
  };
  t.after(() => { globalThis.window = originals.window; globalThis.XMLHttpRequest = originals.xhr; });
  return requests;
}
const file = new File(["test"], "test.pdf");
const target = { uploadUrl: "https://upload.example.com/test", headers: {} };

test("stalled uploads time out instead of waiting indefinitely", async (t) => {
  const requests = setup(t);
  const upload = uploadPrivateResourceFile(file, target, () => {}, { retries: 0 });
  const rejected = assert.rejects(upload, (error) => error.status === 408);
  assert.ok(requests[0].timeout >= 300_000);
  t.mock.timers.tick(60_000);
  await rejected;
});

test("upload progress renews the idle timeout", async (t) => {
  const requests = setup(t);
  const upload = uploadPrivateResourceFile(file, target, () => {}, { retries: 0 });
  t.mock.timers.tick(40_000);
  requests[0].upload.dispatchEvent(Object.assign(new Event("progress"), { loaded: 2, total: 4, lengthComputable: true }));
  t.mock.timers.tick(40_000);
  requests[0].status = 200;
  requests[0].dispatchEvent(new Event("load"));
  await upload;
});

test("native upload timeout uses the existing retry path", async (t) => {
  const requests = setup(t, (request, number) => {
    if (number === 1) request.dispatchEvent(new Event("timeout"));
    else { request.status = 200; request.dispatchEvent(new Event("load")); }
  });
  const upload = uploadPrivateResourceFile(file, target, () => {});
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(1000);
  await upload;
  assert.equal(requests.length, 2);
});

test("user cancellation stays an AbortError and is never retried", async (t) => {
  const requests = setup(t);
  const controller = new AbortController();
  const upload = uploadPrivateResourceFile(file, target, () => {}, { signal: controller.signal });
  const rejected = assert.rejects(upload, { name: "AbortError" });
  controller.abort();
  await rejected;
  t.mock.timers.tick(120_000);
  assert.equal(requests.length, 1);
});
