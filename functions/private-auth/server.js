import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createHandler } from "./index.js";

const MAX_BODY_BYTES = 128 * 1024;

class RequestBodyError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function firstHeader(headers, name) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY_BYTES) {
      throw new RequestBodyError(413, "REQUEST_TOO_LARGE", "Request body is too large");
    }
    chunks.push(buffer);
  }
  return bytes ? Buffer.concat(chunks, bytes).toString("utf8") : undefined;
}

function fcCredentials(headers) {
  return {
    accessKeyId: firstHeader(headers, "x-fc-access-key-id"),
    accessKeySecret: firstHeader(headers, "x-fc-access-key-secret"),
    securityToken: firstHeader(headers, "x-fc-security-token"),
  };
}

function transportCorsOrigin(headers, env) {
  const expected = env.WEBAUTHN_ORIGIN || "https://yanxiao.me";
  const rpID = env.WEBAUTHN_RP_ID || new URL(expected).hostname;
  const origin = firstHeader(headers, "origin");
  try {
    const url = new URL(origin);
    if (url.origin === origin && url.protocol === "https:" && !url.port &&
        (url.hostname === rpID || url.hostname.endsWith(`.${rpID}`))) {
      return origin;
    }
  } catch {
    // Return the configured origin so an untrusted caller never receives a matching CORS header.
  }
  return expected;
}

function transportError(error, env, headers = {}) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "Private authentication service is unavailable" : error.message;
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": transportCorsOrigin(headers, env),
      "access-control-allow-credentials": "true",
      vary: "Origin",
    },
    body: JSON.stringify({ code, message }),
  };
}

function isAsyncIterable(value) {
  return value && typeof value[Symbol.asyncIterator] === "function";
}

function streamErrorEvent(error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const code = typeof error?.code === "string" ? error.code : "STREAM_ERROR";
  const message = status >= 500 ? "AI service is unavailable" : error.message;
  return `event: error\ndata: ${JSON.stringify({ status, code, message })}\n\n`;
}

async function writeResponse(response, result) {
  response.statusCode = result.statusCode;
  for (const [name, value] of Object.entries(result.headers || {})) {
    if (value !== undefined) response.setHeader(name, value);
  }
  if (!isAsyncIterable(result.body)) {
    response.end(result.body || "");
    return;
  }
  try {
    for await (const chunk of result.body) {
      if (!response.write(chunk)) {
        await new Promise((resolve) => {
          const finish = () => {
            response.off("drain", finish);
            response.off("close", finish);
            resolve();
          };
          response.once("drain", finish);
          response.once("close", finish);
        });
      }
    }
    response.end();
  } catch (error) {
    if (!response.headersSent) throw error;
    if (!response.writableEnded && !response.destroyed) {
      response.end(streamErrorEvent(error));
    }
  }
}

export function createWebServer({ env = process.env, handler = createHandler({ env }) } = {}) {
  return createServer(async (request, response) => {
    const controller = new AbortController();
    const abort = () => {
      if (!response.writableEnded) controller.abort();
    };
    request.once("aborted", abort);
    response.once("close", abort);
    try {
      const result = await handler({
        method: request.method,
        path: new URL(request.url || "/", "http://fc.local").pathname,
        headers: request.headers,
        body: await readBody(request),
        sourceIp: firstHeader(request.headers, "x-fc-client-ip") || request.socket.remoteAddress,
        credentials: fcCredentials(request.headers),
        signal: controller.signal,
      });
      await writeResponse(response, result);
    } catch (error) {
      if (!response.headersSent) await writeResponse(response, transportError(error, env, request.headers));
      else if (!response.writableEnded && !response.destroyed) response.end();
    } finally {
      request.off("aborted", abort);
      response.off("close", abort);
    }
  });
}

export function startWebServer({ env = process.env } = {}) {
  const port = Number(env.FC_SERVER_PORT || 9000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("FC_SERVER_PORT is invalid");
  }
  const server = createWebServer({ env });
  server.listen(port, "0.0.0.0");
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startWebServer();
}
