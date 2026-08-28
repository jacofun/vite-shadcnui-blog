import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const DEFAULT_COOKIE_NAME = "__Secure-private_auth";
const DEFAULT_COOKIE_PATH = "/api/private-auth/";
const DEFAULT_PRIVATE_PREFIX = "/private/english-learning/6minuteenglish";
const TOKEN_AAD = Buffer.from("yanxiao-private-auth:v1", "utf8");
const EPISODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_TRANSPORTS = new Set([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function requiredString(env, name, { minLength = 1 } = {}) {
  const value = env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} is not configured`);
  }
  return value;
}

function integerSetting(env, name, fallback, { min, max }) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} is invalid`);
  }
  return value;
}

function decodeBase64Url(value, name) {
  if (!value || !BASE64URL_PATTERN.test(value)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} is not base64url`);
  }
  return Buffer.from(value, "base64url");
}

function loadSessionKey(env, name, required) {
  const value = env[name]?.trim();
  if (!value && !required) return null;
  const key = decodeBase64Url(
    value || requiredString(env, name),
    name,
  );
  if (key.length !== 32) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} must contain 32 bytes`);
  }
  return key;
}

function normalizeOrigin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} is not a valid URL`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} must be an HTTPS origin`);
  }

  return url.origin;
}

function normalizePrivatePrefix(value) {
  const prefix = value?.trim() || DEFAULT_PRIVATE_PREFIX;
  if (!prefix.startsWith("/") || prefix.endsWith("/") || prefix.includes("..")) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "PRIVATE_RESOURCE_PREFIX is invalid");
  }
  return prefix;
}

function normalizeTransports(transports, name) {
  if (transports === undefined) return undefined;
  if (!Array.isArray(transports) || transports.some((item) => !ALLOWED_TRANSPORTS.has(item))) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name}.transports is invalid`);
  }
  return transports;
}

function normalizeCredential(raw, name) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name} is invalid`);
  }

  const id = raw.id?.trim();
  const publicKey = raw.publicKey?.trim();
  if (!id || !BASE64URL_PATTERN.test(id)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name}.id is invalid`);
  }

  const counter = raw.counter ?? 0;
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new HttpError(500, "CONFIGURATION_ERROR", `${name}.counter is invalid`);
  }

  return {
    id,
    publicKey: new Uint8Array(decodeBase64Url(publicKey, `${name}.publicKey`)),
    counter,
    transports: normalizeTransports(raw.transports, name),
  };
}

function loadCredentials(env) {
  const credentialsJson = env.WEBAUTHN_CREDENTIALS_JSON?.trim();
  let rawCredentials;

  if (credentialsJson) {
    try {
      rawCredentials = JSON.parse(credentialsJson);
    } catch {
      throw new HttpError(500, "CONFIGURATION_ERROR", "WEBAUTHN_CREDENTIALS_JSON is invalid JSON");
    }
  } else {
    rawCredentials = [{
      id: requiredString(env, "WEBAUTHN_CREDENTIAL_ID"),
      publicKey: requiredString(env, "WEBAUTHN_PUBLIC_KEY"),
      counter: 0,
      transports: ["internal", "hybrid"],
    }];
  }

  if (!Array.isArray(rawCredentials) || rawCredentials.length < 1 || rawCredentials.length > 10) {
    throw new HttpError(
      500,
      "CONFIGURATION_ERROR",
      "WEBAUTHN_CREDENTIALS_JSON must contain 1 to 10 credentials",
    );
  }

  const credentials = rawCredentials.map((item, index) =>
    normalizeCredential(item, `WEBAUTHN_CREDENTIALS_JSON[${index}]`));

  if (new Set(credentials.map((credential) => credential.id)).size !== credentials.length) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "WebAuthn credential IDs must be unique");
  }
  return credentials;
}

function loadConfig(env) {
  const expectedOrigin = normalizeOrigin(
    requiredString(env, "WEBAUTHN_ORIGIN"),
    "WEBAUTHN_ORIGIN",
  );
  const rpID = requiredString(env, "WEBAUTHN_RP_ID");
  if (new URL(expectedOrigin).hostname !== rpID && !new URL(expectedOrigin).hostname.endsWith(`.${rpID}`)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "WEBAUTHN_RP_ID does not match WEBAUTHN_ORIGIN");
  }

  const cdnOrigin = normalizeOrigin(
    env.CDN_PUBLIC_ORIGIN?.trim() || expectedOrigin,
    "CDN_PUBLIC_ORIGIN",
  );
  const cdnAuthKey = requiredString(env, "CDN_AUTH_KEY", { minLength: 6 });
  if (!/^[A-Za-z0-9]{6,128}$/.test(cdnAuthKey)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "CDN_AUTH_KEY must be 6 to 128 alphanumeric characters");
  }

  const originVerifyKey = requiredString(env, "CDN_ORIGIN_VERIFY_KEY", { minLength: 32 });
  const cookieName = env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;
  const cookiePath = env.AUTH_COOKIE_PATH?.trim() || DEFAULT_COOKIE_PATH;
  if (!cookieName.startsWith("__Secure-") || !cookiePath.startsWith("/") || !cookiePath.endsWith("/")) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "AUTH_COOKIE_NAME or AUTH_COOKIE_PATH is invalid");
  }

  return {
    expectedOrigin,
    rpID,
    credentials: loadCredentials(env),
    currentSessionKey: loadSessionKey(env, "SESSION_CURRENT_KEY", true),
    previousSessionKey: loadSessionKey(env, "SESSION_PREVIOUS_KEY", false),
    sessionVersion: env.SESSION_VERSION?.trim() || "1",
    sessionTtlSeconds: integerSetting(env, "SESSION_TTL_SECONDS", 2_592_000, {
      min: 300,
      max: 2_678_400,
    }),
    challengeTtlSeconds: integerSetting(env, "WEBAUTHN_CHALLENGE_TTL_SECONDS", 300, {
      min: 60,
      max: 600,
    }),
    cdnUrlTtlSeconds: integerSetting(env, "CDN_URL_TTL_SECONDS", 3_600, {
      min: 60,
      max: 7_200,
    }),
    cdnOrigin,
    cdnAuthKey,
    originVerifyKey,
    privatePrefix: normalizePrivatePrefix(env.PRIVATE_RESOURCE_PREFIX),
    cookieName,
    cookiePath,
  };
}

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual || "", "utf8");
  const expectedBuffer = Buffer.from(expected || "", "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function encryptToken(payload, key, randomBytesImpl = randomBytes) {
  const iv = randomBytesImpl(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

function decryptToken(token, keys) {
  const parts = token?.split(".");
  if (!parts || parts.length !== 4 || parts[0] !== "v1") return null;

  let iv;
  let ciphertext;
  let tag;
  try {
    iv = Buffer.from(parts[1], "base64url");
    ciphertext = Buffer.from(parts[2], "base64url");
    tag = Buffer.from(parts[3], "base64url");
  } catch {
    return null;
  }
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;

  for (const key of keys.filter(Boolean)) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(TOKEN_AAD);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plaintext);
    } catch {
      // Try the previous rotation key without exposing which key failed.
    }
  }
  return null;
}

function parseCookies(value) {
  const result = {};
  for (const part of (value || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const cookieValue = part.slice(separator + 1).trim();
    if (name) result[name] = cookieValue;
  }
  return result;
}

function serializeCookie(config, value, maxAge) {
  return [
    `${config.cookieName}=${value}`,
    `Path=${config.cookiePath}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

function clearCookie(config) {
  return serializeCookie(config, "", 0);
}

function normalizeHeaders(rawHeaders = {}) {
  const headers = {};
  for (const [name, value] of Object.entries(rawHeaders || {})) {
    headers[name.toLowerCase()] = Array.isArray(value) ? value[0] : String(value ?? "");
  }
  return headers;
}

function parseEvent(event) {
  let parsed = event;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString("utf8");
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new HttpError(400, "INVALID_REQUEST", "Request event is not valid JSON");
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new HttpError(400, "INVALID_REQUEST", "Request event is invalid");
  }

  const method = String(
    parsed.requestContext?.http?.method || parsed.httpMethod || parsed.method || "GET",
  ).toUpperCase();
  const path = String(parsed.rawPath || parsed.path || parsed.requestContext?.http?.path || "/")
    .split("?", 1)[0];
  const headers = normalizeHeaders(parsed.headers);

  let body = parsed.body;
  if (parsed.isBase64Encoded && typeof body === "string") {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  if (typeof body === "string" && Buffer.byteLength(body, "utf8") > 131_072) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large");
  }

  return { method, path, headers, body };
}

function parseJsonBody(body) {
  if (body && typeof body === "object") return body;
  if (!body) throw new HttpError(400, "INVALID_JSON", "JSON request body is required");
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object");
  }
}

function routeName(path, cookiePath) {
  const normalized = path.replace(/\/+$/, "") || "/";
  const apiPrefix = cookiePath.replace(/\/+$/, "");
  const knownRoutes = ["challenge", "verify", "session", "sign", "logout"];
  return knownRoutes.find((route) =>
    normalized === `/${route}` || normalized === `${apiPrefix}/${route}`);
}

function jsonResponse(config, statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    isBase64Encoded: false,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "access-control-allow-origin": config.expectedOrigin,
      "access-control-allow-credentials": "true",
      vary: "Origin",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function emptyResponse(config, statusCode, extraHeaders = {}) {
  return {
    statusCode,
    isBase64Encoded: false,
    headers: {
      "cache-control": "no-store",
      "access-control-allow-origin": config.expectedOrigin,
      "access-control-allow-credentials": "true",
      vary: "Origin",
      ...extraHeaders,
    },
    body: "",
  };
}

function requireExpectedOrigin(request, config) {
  if (!constantTimeEqual(request.headers.origin, config.expectedOrigin)) {
    throw new HttpError(403, "INVALID_ORIGIN", "Request origin is not allowed");
  }
}

function requireOriginGateway(request, config) {
  if (!constantTimeEqual(request.headers["x-origin-verify"], config.originVerifyKey)) {
    throw new HttpError(403, "FORBIDDEN", "Request did not pass the configured CDN origin");
  }
}

function readAuthToken(request, config, nowSeconds, expectedKind) {
  const token = parseCookies(request.headers.cookie)[config.cookieName];
  const payload = decryptToken(token, [config.currentSessionKey, config.previousSessionKey]);
  if (
    !payload ||
    payload.kind !== expectedKind ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= nowSeconds
  ) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required");
  }
  return payload;
}

function requireSession(request, config, nowSeconds) {
  const session = readAuthToken(request, config, nowSeconds, "session");
  if (session.sub !== "owner" || session.version !== config.sessionVersion || !session.csrf) {
    throw new HttpError(401, "UNAUTHENTICATED", "Session is no longer valid");
  }
  return session;
}

function requireCsrf(request, session) {
  if (!constantTimeEqual(request.headers["x-csrf-token"], session.csrf)) {
    throw new HttpError(403, "INVALID_CSRF_TOKEN", "CSRF token is missing or invalid");
  }
}

function signCdnPath(path, config, nowSeconds, randomBytesImpl = randomBytes) {
  const timestamp = nowSeconds;
  const rand = randomBytesImpl(16).toString("hex");
  const uid = "0";
  const digest = createHash("md5")
    .update(`${path}-${timestamp}-${rand}-${uid}-${config.cdnAuthKey}`, "utf8")
    .digest("hex");
  const authKey = `${timestamp}-${rand}-${uid}-${digest}`;
  return `${config.cdnOrigin}${path}?auth_key=${authKey}`;
}

function signedResources(body, config, nowSeconds, randomBytesImpl) {
  if (body.resource === "index" && body.episodeId === undefined) {
    const path = `${config.privatePrefix}/index.json`;
    return { index: signCdnPath(path, config, nowSeconds, randomBytesImpl) };
  }

  const episodeId = body.episodeId;
  if (typeof episodeId !== "string" || !EPISODE_ID_PATTERN.test(episodeId)) {
    throw new HttpError(400, "INVALID_EPISODE_ID", "episodeId is invalid");
  }
  if (body.resource !== undefined) {
    throw new HttpError(400, "INVALID_RESOURCE_REQUEST", "resource cannot be combined with episodeId");
  }

  const prefix = `${config.privatePrefix}/${episodeId}`;
  return Object.fromEntries([
    ["metadata", "metadata.json"],
    ["audio", "audio.mp3"],
    ["transcriptText", "transcript.txt"],
    ["transcriptPdf", "transcript.pdf"],
  ].map(([name, filename]) => [
    name,
    signCdnPath(`${prefix}/${filename}`, config, nowSeconds, randomBytesImpl),
  ]));
}

export function createHandler({
  env = process.env,
  now = () => Math.floor(Date.now() / 1000),
  randomBytesImpl = randomBytes,
  generateAuthenticationOptionsImpl = generateAuthenticationOptions,
  verifyAuthenticationResponseImpl = verifyAuthenticationResponse,
} = {}) {
  return async function privateAuthHandler(event) {
    let config;
    try {
      config = loadConfig(env);
      const request = parseEvent(event);
      requireOriginGateway(request, config);

      if (request.method === "OPTIONS") {
        requireExpectedOrigin(request, config);
        return emptyResponse(config, 204, {
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, X-CSRF-Token",
          "access-control-max-age": "86400",
        });
      }

      const route = routeName(request.path, config.cookiePath);
      if (!route) throw new HttpError(404, "NOT_FOUND", "Route does not exist");

      const expectedMethod = route === "session" ? "GET" : "POST";
      if (request.method !== expectedMethod) {
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
      }
      if (request.method === "POST") requireExpectedOrigin(request, config);

      const nowSeconds = now();

      if (route === "challenge") {
        const options = await generateAuthenticationOptionsImpl({
          rpID: config.rpID,
          allowCredentials: config.credentials.map(({ id, transports }) => ({ id, transports })),
          timeout: 60_000,
          userVerification: "required",
        });
        const challengeToken = encryptToken({
          kind: "challenge",
          challenge: options.challenge,
          exp: nowSeconds + config.challengeTtlSeconds,
        }, config.currentSessionKey, randomBytesImpl);

        return jsonResponse(config, 200, { publicKey: options }, {
          "set-cookie": serializeCookie(config, challengeToken, config.challengeTtlSeconds),
        });
      }

      if (route === "verify") {
        const challenge = readAuthToken(request, config, nowSeconds, "challenge");
        const body = parseJsonBody(request.body);
        const response = body.credential ||
          (body.response && typeof body.response.id === "string" ? body.response : body);
        const credential = config.credentials.find((item) => item.id === response.id);
        if (!credential) throw new HttpError(401, "UNKNOWN_CREDENTIAL", "Credential is not registered");

        let verification;
        try {
          verification = await verifyAuthenticationResponseImpl({
            response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: config.expectedOrigin,
            expectedRPID: config.rpID,
            credential,
            requireUserVerification: true,
          });
        } catch {
          throw new HttpError(401, "PASSKEY_VERIFICATION_FAILED", "Passkey verification failed");
        }
        if (!verification.verified || !verification.authenticationInfo?.userVerified) {
          throw new HttpError(401, "PASSKEY_VERIFICATION_FAILED", "Passkey verification failed");
        }

        const csrf = randomBytesImpl(32).toString("base64url");
        const expiresAt = nowSeconds + config.sessionTtlSeconds;
        const sessionToken = encryptToken({
          kind: "session",
          sub: "owner",
          version: config.sessionVersion,
          csrf,
          iat: nowSeconds,
          exp: expiresAt,
        }, config.currentSessionKey, randomBytesImpl);

        return jsonResponse(config, 200, {
          authenticated: true,
          csrfToken: csrf,
          expiresAt,
        }, {
          "set-cookie": serializeCookie(config, sessionToken, config.sessionTtlSeconds),
        });
      }

      if (route === "session") {
        const session = requireSession(request, config, nowSeconds);
        return jsonResponse(config, 200, {
          authenticated: true,
          csrfToken: session.csrf,
          expiresAt: session.exp,
        });
      }

      const session = requireSession(request, config, nowSeconds);
      requireCsrf(request, session);

      if (route === "sign") {
        const body = parseJsonBody(request.body);
        return jsonResponse(config, 200, {
          expiresAt: nowSeconds + config.cdnUrlTtlSeconds,
          resources: signedResources(body, config, nowSeconds, randomBytesImpl),
        });
      }

      return jsonResponse(config, 200, { authenticated: false }, {
        "set-cookie": clearCookie(config),
      });
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
      const message = statusCode >= 500 ? "Private authentication service is unavailable" : error.message;
      const responseConfig = config || {
        expectedOrigin: env.WEBAUTHN_ORIGIN || "https://yanxiao.me",
      };
      return jsonResponse(responseConfig, statusCode, { code, message });
    }
  };
}

export const handler = createHandler();

export const __test = {
  decryptToken,
  encryptToken,
  loadConfig,
  parseEvent,
  signCdnPath,
};
