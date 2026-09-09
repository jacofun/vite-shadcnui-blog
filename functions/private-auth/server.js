import http from "node:http";
import { pathToFileURL } from "node:url";

import { createHandler } from "./index.js";

const MAX_REQUEST_BYTES = 128 * 1024;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!tooLarge) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", (error) => {
      if (!tooLarge) reject(error);
    });
  });
}

function writeHandlerResponse(response, result) {
  response.statusCode = result.statusCode || 200;
  for (const [name, value] of Object.entries(result.headers || {})) {
    if (value !== undefined && name.toLowerCase() !== "content-length") {
      response.setHeader(name, value);
    }
  }
  response.end(result.body || "");
}

function parseResultBody(result) {
  try {
    return JSON.parse(result.body || "{}");
  } catch {
    return {};
  }
}

function writeSseEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createHttpServer({ env = process.env, createHandlerImpl = createHandler } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.pathname === "/ready") {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("ready");
      return;
    }

    const abortController = new AbortController();
    let streamStarted = false;
    response.on("close", () => {
      if (!response.writableEnded) abortController.abort();
    });

    const startStream = () => {
      if (streamStarted || response.destroyed) return;
      streamStarted = true;
      response.statusCode = 200;
      response.setHeader("content-type", "text/event-stream; charset=utf-8");
      response.setHeader("cache-control", "no-cache, no-store, no-transform");
      response.setHeader("x-accel-buffering", "no");
      response.setHeader("access-control-allow-origin", env.WEBAUTHN_ORIGIN || "https://yanxiao.me");
      response.setHeader("access-control-allow-credentials", "true");
      response.setHeader("vary", "Origin");
      response.setHeader("x-content-type-options", "nosniff");
      response.flushHeaders();
    };

    try {
      const body = await readBody(request);
      const event = {
        requestContext: {
          http: {
            method: request.method,
            path: url.pathname,
            sourceIp: request.socket.remoteAddress,
          },
        },
        rawPath: url.pathname,
        headers: request.headers,
        body,
      };
      const context = {
        credentials: {
          accessKeyId: request.headers["x-fc-access-key-id"] || env.ALIBABA_CLOUD_ACCESS_KEY_ID,
          accessKeySecret: request.headers["x-fc-access-key-secret"] || env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
          securityToken: request.headers["x-fc-security-token"] || env.ALIBABA_CLOUD_SECURITY_TOKEN,
        },
      };
      const handler = createHandlerImpl({
        env,
        requestSignal: abortController.signal,
        onAssistantDelta(delta) {
          if (!delta || response.destroyed) return;
          startStream();
          writeSseEvent(response, "delta", { delta });
        },
      });
      const result = await handler(event, context);

      if (streamStarted) {
        if (result.statusCode >= 400) {
          writeSseEvent(response, "error", parseResultBody(result));
        } else {
          const payload = parseResultBody(result);
          writeSseEvent(response, "done", { model: payload.model });
        }
        response.end();
        return;
      }
      writeHandlerResponse(response, result);
    } catch (error) {
      if (response.destroyed) return;
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      const payload = {
        code: statusCode === 413 ? "PAYLOAD_TOO_LARGE" : "INTERNAL_ERROR",
        message: statusCode === 413 ? error.message : "Private authentication service is unavailable",
      };
      if (streamStarted) {
        writeSseEvent(response, "error", payload);
        response.end();
      } else {
        response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(payload));
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FC_SERVER_PORT || process.env.PORT || 9000);
  createHttpServer().listen(port, "0.0.0.0");
}
