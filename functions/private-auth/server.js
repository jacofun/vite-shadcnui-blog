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

function transportError(error, env) {
  const statusCode = error instanceof RequestBodyError ? error.statusCode : 500;
  const code = error instanceof RequestBodyError ? error.code : "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "Private authentication service is unavailable" : error.message;
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": env.WEBAUTHN_ORIGIN || "https://yanxiao.me",
      "access-control-allow-credentials": "true",
      vary: "Origin",
    },
    body: JSON.stringify({ code, message }),
  };
}

function writeResponse(response, result) {
  response.statusCode = result.statusCode;
  for (const [name, value] of Object.entries(result.headers || {})) {
    if (value !== undefined) response.setHeader(name, value);
  }
  response.end(result.body || "");
}

export function createWebServer({ env = process.env, handler = createHandler({ env }) } = {}) {
  return createServer(async (request, response) => {
    try {
      const result = await handler({
        method: request.method,
        path: new URL(request.url || "/", "http://fc.local").pathname,
        headers: request.headers,
        body: await readBody(request),
        sourceIp: firstHeader(request.headers, "x-fc-client-ip") || request.socket.remoteAddress,
        credentials: fcCredentials(request.headers),
      });
      writeResponse(response, result);
    } catch (error) {
      writeResponse(response, transportError(error, env));
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
