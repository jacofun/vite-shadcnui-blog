import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

const DEFAULT_COOKIE_NAME = "__Secure-private_auth";
const DEFAULT_COOKIE_PATH = "/api/private-auth/";
const DEFAULT_PRIVATE_ROOT = "/private";
const DEFAULT_PRIVATE_PREFIX = "/private/english-learning/6minuteenglish";
const TOKEN_AAD = Buffer.from("yanxiao-private-auth:v1", "utf8");
const EPISODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const RESOURCE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const RESOURCE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PRIVATE_RESOURCE_PERMISSIONS = new Set(["private-resources", "english-learning"]);
const MAX_SIGNED_RESOURCES = 12;
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

function normalizePrivateRoot(value) {
  const root = value?.trim() || DEFAULT_PRIVATE_ROOT;
  if (!root.startsWith("/") || root.endsWith("/") || root.includes("..")) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "PRIVATE_RESOURCE_ROOT is invalid");
  }
  return root;
}

function normalizePrivatePrefix(value, privateRoot) {
  const prefix = value?.trim() || DEFAULT_PRIVATE_PREFIX;
  if (
    !prefix.startsWith(`${privateRoot}/`) ||
    prefix.endsWith("/") ||
    prefix.includes("..")
  ) {
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
  const storeMode = env.AUTH_STORE || "environment";
  if (!["environment", "oss"].includes(storeMode)) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "AUTH_STORE is invalid");
  }
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

  const privateRoot = normalizePrivateRoot(env.PRIVATE_RESOURCE_ROOT);
  return {
    expectedOrigin,
    rpID,
    storeMode,
    credentials: storeMode === "environment" ? loadCredentials(env) : [],
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
    privateRoot,
    privatePrefix: normalizePrivatePrefix(env.PRIVATE_RESOURCE_PREFIX, privateRoot),
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

  // Only trust platform-provided source IP, never a caller's X-Forwarded-For.
  const sourceIp = parsed.requestContext?.http?.sourceIp;
  return { method, path, headers, body, sourceIp };
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

function routeName(path, cookiePath, persistent = false) {
  const normalized = path.replace(/\/+$/, "") || "/";
  const apiPrefix = cookiePath.replace(/\/+$/, "");
  const knownRoutes = ["challenge", "verify", "session", "sign", "logout"];
  if (persistent) knownRoutes.push(
    "register/options", "register/verify", "reauth/challenge", "reauth/verify",
    "passkeys", "passkeys/options", "passkeys/verify", "passkeys/rename", "passkeys/remove",
  );
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

function normalizePrivateResourcePath(path, config) {
  if (
    typeof path !== "string" ||
    path.length > 768 ||
    !path.startsWith(`${config.privateRoot}/`) ||
    path.includes("\\") ||
    path.includes("%") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes("//")
  ) {
    throw new HttpError(400, "INVALID_RESOURCE_PATH", "Private resource path is invalid");
  }
  const segments = path.slice(config.privateRoot.length + 1).split("/");
  if (!segments.length || segments.some((segment) => !RESOURCE_PATH_SEGMENT_PATTERN.test(segment))) {
    throw new HttpError(400, "INVALID_RESOURCE_PATH", "Private resource path is invalid");
  }
  return path;
}

function signNamedPaths(paths, config, nowSeconds, randomBytesImpl) {
  if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
    throw new HttpError(400, "INVALID_RESOURCE_REQUEST", "paths must be an object");
  }
  const entries = Object.entries(paths);
  if (!entries.length || entries.length > MAX_SIGNED_RESOURCES) {
    throw new HttpError(400, "INVALID_RESOURCE_REQUEST", "paths must contain 1 to 12 resources");
  }
  return Object.fromEntries(entries.map(([name, path]) => {
    if (!RESOURCE_NAME_PATTERN.test(name)) {
      throw new HttpError(400, "INVALID_RESOURCE_NAME", "Private resource name is invalid");
    }
    return [name, signCdnPath(
      normalizePrivateResourcePath(path, config),
      config,
      nowSeconds,
      randomBytesImpl,
    )];
  }));
}

function signedResources(body, config, nowSeconds, randomBytesImpl) {
  if (body.resource === "catalog" && body.paths === undefined && body.episodeId === undefined) {
    return {
      catalog: signCdnPath(`${config.privateRoot}/index.json`, config, nowSeconds, randomBytesImpl),
    };
  }

  if (body.paths !== undefined) {
    if (body.resource !== undefined || body.episodeId !== undefined) {
      throw new HttpError(400, "INVALID_RESOURCE_REQUEST", "paths cannot be combined with legacy resource fields");
    }
    return signNamedPaths(body.paths, config, nowSeconds, randomBytesImpl);
  }

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

function hasPrivateResourceAccess(user) {
  return user.role === "owner" ||
    user.permissions.some((permission) => PRIVATE_RESOURCE_PERMISSIONS.has(permission));
}

export function createHandler({
  env = process.env,
  now = () => Math.floor(Date.now() / 1000),
  randomBytesImpl = randomBytes,
  generateAuthenticationOptionsImpl = generateAuthenticationOptions,
  verifyAuthenticationResponseImpl = verifyAuthenticationResponse,
  generateRegistrationOptionsImpl = generateRegistrationOptions,
  verifyRegistrationResponseImpl = verifyRegistrationResponse,
  store,
} = {}) {
  return async function privateAuthHandler(event, context = {}) {
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

      const route = routeName(request.path, config.cookiePath, config.storeMode === "oss");
      if (!route) throw new HttpError(404, "NOT_FOUND", "Route does not exist");

      const expectedMethod = ["session", "passkeys"].includes(route) ? "GET" : "POST";
      if (request.method !== expectedMethod) {
        throw new HttpError(405, "METHOD_NOT_ALLOWED", "Method is not allowed");
      }
      if (request.method === "POST") requireExpectedOrigin(request, config);

      const nowSeconds = now();

      if (config.storeMode === "oss") {
        const persistentStore = store || await createOssEventStore({ env, context });
        return await persistentRequest({
          request, route, config, store: persistentStore, nowSeconds, randomBytesImpl,
          generateAuthenticationOptionsImpl, verifyAuthenticationResponseImpl,
          generateRegistrationOptionsImpl, verifyRegistrationResponseImpl,
        });
      }

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

// Private, small-group registry. All security transitions append one complete state
// event to OSS at the expected byte position. The append position is the CAS token,
// so concurrent FC invocations cannot overwrite each other. Kept in this entrypoint
// because the existing deployment ZIP includes index.js only.
const REGISTRY_MAX_BYTES = 60 * 1024;
const MAX_USERS = 20;
const MAX_PASSKEYS = 8;
const RECENT_AUTH_SECONDS = 300;
const INVITATION_TOKEN_BYTES = 12;
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16}$/;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const opaqueId = (random = randomBytes) => random(24).toString("hex");

function emptyRegistry() {
  return { schemaVersion: 1, users: {}, credentials: {}, invites: {}, challenges: {}, sessions: {}, rates: {} };
}

function validateRegistry(state) {
  if (state?.schemaVersion !== 1 || ["users", "credentials", "invites", "challenges", "sessions", "rates"]
    .some((key) => !state[key] || typeof state[key] !== "object" || Array.isArray(state[key]))) {
    throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication store is invalid");
  }
  return state;
}

function pruneRegistry(state, nowSeconds) {
  for (const collection of ["invites", "challenges", "sessions", "rates"]) {
    for (const [key, value] of Object.entries(state[collection])) {
      if (value.exp <= nowSeconds) delete state[collection][key];
    }
  }
}

/** Compare-and-swap adapter; tests supply the same atomic contract, never production memory storage. */
export function createRegistryStore({ readRow, compareAndSwap, takeRateLimit }) {
  return {
    async read() {
      const row = await readRow();
      if (!row) throw new HttpError(503, "AUTH_STORE_NOT_INITIALIZED", "Initialize the authentication store first");
      return validateRegistry(row.state);
    },
    async mutate(change, { initialize = false } = {}) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const row = await readRow();
        if (!row && !initialize) {
          throw new HttpError(503, "AUTH_STORE_NOT_INITIALIZED", "Initialize the authentication store first");
        }
        const state = row ? validateRegistry(row.state) : emptyRegistry();
        // change must be synchronous and side-effect free: a conflict retries it.
        const result = change(state);
        if (Buffer.byteLength(JSON.stringify(state)) > REGISTRY_MAX_BYTES) {
          throw new HttpError(503, "AUTH_STORE_CAPACITY", "Authentication store capacity reached");
        }
        if (await compareAndSwap(row?.revision ?? null, state)) return result;
      }
      throw new HttpError(409, "AUTH_STORE_CONFLICT", "Concurrent update; retry the same request");
    },
    ...(takeRateLimit ? { takeRateLimit } : {}),
  };
}

function ossErrorStatus(error) {
  return error?.status || error?.statusCode || error?.res?.status;
}

function isOssMissing(error) {
  return error?.code === "NoSuchKey" || ossErrorStatus(error) === 404;
}

function isOssAppendConflict(error) {
  return error?.code === "PositionNotEqualToLength" || ossErrorStatus(error) === 409;
}

function parseOssRevision(revision) {
  if (revision === null) return { position: 0, sequence: 0 };
  const match = /^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.exec(revision || "");
  if (!match) throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication store revision is invalid");
  const position = Number(match[1]);
  const sequence = Number(match[2]);
  if (!Number.isSafeInteger(position) || !Number.isSafeInteger(sequence)) {
    throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication store revision is invalid");
  }
  return { position, sequence };
}

function parseOssEvents(content, startPosition, startSequence, initialState) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content || "");
  if (buffer.length && buffer[buffer.length - 1] !== 0x0a) {
    throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication event log is truncated");
  }
  let position = startPosition;
  let sequence = startSequence;
  let state = initialState;
  for (const rawLine of buffer.toString("utf8").split("\n")) {
    if (!rawLine) continue;
    let event;
    try {
      event = JSON.parse(rawLine);
    } catch {
      throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication event log contains invalid JSON");
    }
    const lineBytes = Buffer.byteLength(`${rawLine}\n`);
    const nextPosition = position + lineBytes;
    if (event?.schemaVersion !== 1 || event.previousPosition !== position ||
        event.nextPosition !== nextPosition || event.sequence !== sequence + 1) {
      throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication event chain is invalid");
    }
    state = validateRegistry(event.state);
    position = nextPosition;
    sequence = event.sequence;
  }
  return { position, sequence, state };
}

/**
 * OSS is the only persistent service. Mounted OSS remains useful for inspection,
 * but authoritative writes use AppendObject because mount rename/file locking is
 * not atomic across FC instances.
 */
export async function createOssEventStore({ env = process.env, context = {}, sdk, client } = {}) {
  const OSS = sdk || (client ? null : (await import("ali-oss")).default);
  const bucket = requiredString(env, "OSS_AUTH_BUCKET");
  const region = requiredString(env, "OSS_AUTH_REGION");
  const endpoint = normalizeOrigin(requiredString(env, "OSS_AUTH_ENDPOINT"), "OSS_AUTH_ENDPOINT");
  const logObject = (env.OSS_AUTH_LOG_OBJECT?.trim() || "fc/private-auth/store/events.jsonl").replace(/^\/+/, "");
  const snapshotObject = (env.OSS_AUTH_SNAPSHOT_OBJECT?.trim() || "fc/private-auth/snapshots/snapshot-latest.json").replace(/^\/+/, "");
  const ratePrefix = (env.OSS_AUTH_RATE_PREFIX?.trim() || "fc/private-auth/rate-limits").replace(/^\/+|\/+$/g, "");
  const snapshotInterval = integerSetting(env, "OSS_AUTH_SNAPSHOT_INTERVAL", 50, { min: 10, max: 1000 });
  const maxLogBytes = integerSetting(env, "OSS_AUTH_MAX_LOG_BYTES", 536_870_912, { min: 1_048_576, max: 5_000_000_000 });
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket) || !logObject || !snapshotObject || !ratePrefix ||
      logObject === snapshotObject || [logObject, snapshotObject, ratePrefix].some((value) => value.includes(".."))) {
    throw new HttpError(500, "CONFIGURATION_ERROR", "OSS authentication storage paths are invalid");
  }
  // FC supplies rotating credentials on each invocation. The CLI uses RAM/STS environment credentials.
  const credentials = context.credentials || {
    accessKeyId: env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    securityToken: env.ALIBABA_CLOUD_SECURITY_TOKEN,
  };
  if (!client && (!credentials.accessKeyId || !credentials.accessKeySecret)) {
    throw new HttpError(503, "STORAGE_CREDENTIALS_MISSING", "OSS credentials are not configured");
  }
  const oss = client || new OSS({
    bucket, region, endpoint,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    stsToken: credentials.securityToken,
    secure: true,
    timeout: 3_000,
    retryMax: 0,
  });

  async function objectLength() {
    try {
      const result = await oss.getObjectMeta(logObject);
      const length = Number(result.res.headers["content-length"]);
      if (!Number.isSafeInteger(length) || length < 0) throw new Error("Invalid OSS content length");
      return length;
    } catch (error) {
      if (isOssMissing(error)) return null;
      throw error;
    }
  }

  async function loadSnapshot(logLength) {
    try {
      const result = await oss.get(snapshotObject);
      const snapshot = JSON.parse(Buffer.from(result.content).toString("utf8"));
      if (snapshot?.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.logPosition) ||
          !Number.isSafeInteger(snapshot.sequence) || snapshot.logPosition < 0 ||
          snapshot.logPosition > logLength || snapshot.sequence < 0) return null;
      return { position: snapshot.logPosition, sequence: snapshot.sequence,
        state: validateRegistry(snapshot.state) };
    } catch (error) {
      if (isOssMissing(error) || error instanceof SyntaxError || error instanceof HttpError) return null;
      throw error;
    }
  }

  async function readRow() {
    const length = await objectLength();
    if (length === null) return null;
    const snapshot = await loadSnapshot(length);
    const base = snapshot || { position: 0, sequence: 0, state: undefined };
    if (base.position === length) {
      if (!base.state) throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication event log is empty");
      return { revision: `${base.position}:${base.sequence}`, state: base.state };
    }
    const result = await oss.get(logObject, { headers: { Range: `bytes=${base.position}-` } });
    const parsed = parseOssEvents(result.content, base.position, base.sequence, base.state);
    if (parsed.position < length || !parsed.state) {
      throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication event log is incomplete");
    }
    return { revision: `${parsed.position}:${parsed.sequence}`, state: parsed.state };
  }

  async function appendRateCounter(name, limit, nowSeconds) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let position;
      let count = 0;
      try {
        const meta = await oss.getObjectMeta(name);
        position = Number(meta.res.headers["content-length"]);
        if (!Number.isSafeInteger(position) || position < 0 || position > 64 * 1024) {
          throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication rate counter is invalid");
        }
        if (position > 0) {
          const result = await oss.get(name);
          const content = Buffer.from(result.content).toString("utf8");
          if (!content.endsWith("\n")) {
            throw new HttpError(503, "INVALID_AUTH_STORE", "Authentication rate counter is truncated");
          }
          count = content.split("\n").length - 1;
        }
      } catch (error) {
        if (!isOssMissing(error)) throw error;
        position = 0;
      }
      if (count >= limit) return false;
      const body = Buffer.from(`${nowSeconds}\n`, "utf8");
      try {
        const result = await oss.append(name, body, {
          position,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
        if (Number(result.nextAppendPosition) !== position + body.length) {
          throw new HttpError(503, "INVALID_AUTH_STORE", "OSS returned an invalid rate-counter position");
        }
        return true;
      } catch (error) {
        if (!isOssAppendConflict(error)) throw error;
      }
    }
    throw new HttpError(409, "AUTH_STORE_CONFLICT", "Concurrent update; retry the same request");
  }

  async function takeRateLimit(sourceIp, nowSeconds) {
    const minute = new Date(nowSeconds * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, "");
    if (!await appendRateCounter(`${ratePrefix}/${minute}-global.log`, 120, nowSeconds)) return false;
    if (typeof sourceIp === "string" && sourceIp) {
      return appendRateCounter(`${ratePrefix}/${minute}-ip-${hash(sourceIp)}.log`, 20, nowSeconds);
    }
    return true;
  }

  return createRegistryStore({
    readRow,
    takeRateLimit,
    async compareAndSwap(revision, state) {
      const { position, sequence } = parseOssRevision(revision);
      const nextSequence = sequence + 1;
      const event = {
        schemaVersion: 1,
        eventId: opaqueId(),
        previousPosition: position,
        nextPosition: 0,
        sequence: nextSequence,
        createdAt: new Date().toISOString(),
        state,
      };
      // nextPosition is part of the protected event chain, so calculate until the
      // serialized byte length stabilizes (normally two iterations).
      let body;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        body = Buffer.from(`${JSON.stringify(event)}\n`, "utf8");
        const calculated = position + body.length;
        if (event.nextPosition === calculated) break;
        event.nextPosition = calculated;
      }
      body = Buffer.from(`${JSON.stringify(event)}\n`, "utf8");
      const expectedNextPosition = position + body.length;
      if (event.nextPosition !== expectedNextPosition || expectedNextPosition > maxLogBytes) {
        throw new HttpError(503, "AUTH_STORE_CAPACITY", "Authentication event log capacity reached");
      }
      try {
        const result = await oss.append(logObject, body, {
          position,
          headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
        });
        if (Number(result.nextAppendPosition) !== expectedNextPosition) {
          throw new HttpError(503, "INVALID_AUTH_STORE", "OSS returned an invalid append position");
        }
      } catch (error) {
        if (isOssAppendConflict(error)) return false;
        // Do not blindly retry an ambiguous append. Exact WebAuthn response retries
        // recover through the completion receipt already stored in the registry.
        throw error;
      }
      if (nextSequence % snapshotInterval === 0) {
        const snapshot = Buffer.from(JSON.stringify({ schemaVersion: 1,
          logPosition: expectedNextPosition, sequence: nextSequence, state }), "utf8");
        try {
          await oss.put(snapshotObject, snapshot, {
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch {
          // Snapshot is only a cache. The append-only log remains authoritative.
        }
      }
      return true;
    },
  });
}

function userCredentials(state, userId) {
  return Object.values(state.credentials).filter((credential) => credential.userId === userId);
}

function activeUser(state, userId) {
  const user = Object.hasOwn(state.users, userId || "") ? state.users[userId] : null;
  if (!user || user.status !== "active") {
    throw new HttpError(401, "UNAUTHENTICATED", "Account or session is not active");
  }
  return user;
}

function persistedSession(state, payload, config, nowSeconds) {
  const user = activeUser(state, payload.sub);
  const session = state.sessions[payload.sid];
  if (payload.store !== "oss" || payload.version !== config.sessionVersion ||
      payload.userVersion !== user.version || !session || session.userId !== user.id ||
      session.exp <= nowSeconds || payload.exp <= nowSeconds ||
      !state.credentials[hash(session.credentialId)] || !payload.csrf) {
    throw new HttpError(401, "UNAUTHENTICATED", "Account or session is not active");
  }
  return { user, session };
}

function requireRecent(state, payload, config, nowSeconds) {
  const result = persistedSession(state, payload, config, nowSeconds);
  if (!Number.isSafeInteger(result.session.authTime) ||
      result.session.authTime > nowSeconds || nowSeconds - result.session.authTime > RECENT_AUTH_SECONDS) {
    throw new HttpError(403, "REAUTHENTICATION_REQUIRED", "Verify a Passkey again before managing credentials");
  }
  return result;
}

function label(value, field) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new HttpError(400, "INVALID_LABEL", `${field} must contain 1 to 80 printable characters`);
  }
  return value.trim();
}

function inviteFromToken(state, token, nowSeconds) {
  if (typeof token !== "string" || !INVITATION_TOKEN_PATTERN.test(token)) {
    throw new HttpError(403, "INVALID_INVITATION", "Invitation is invalid or expired");
  }
  const key = hash(token);
  const invite = state.invites[key];
  if (!invite || invite.exp <= nowSeconds || invite.used) {
    throw new HttpError(403, "INVALID_INVITATION", "Invitation is invalid or expired");
  }
  return { key, invite };
}

function sessionResult(payload, user) {
  return {
    authenticated: true, csrfToken: payload.csrf, expiresAt: payload.exp,
    user: { id: user.id, displayName: user.displayName, role: user.role, permissions: user.permissions },
  };
}

function issueSession(state, user, credentialId, config, nowSeconds, seed) {
  const existing = Object.entries(state.sessions).filter(([, session]) => session.userId === user.id)
    .sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (existing.length >= 8) delete state.sessions[existing.shift()[0]];
  const payload = {
    kind: "session", store: "oss", sub: user.id, sid: seed.sid,
    version: config.sessionVersion, userVersion: user.version, csrf: seed.csrf,
    iat: nowSeconds, exp: nowSeconds + config.sessionTtlSeconds,
  };
  state.sessions[seed.sid] = { userId: user.id, credentialId, authTime: nowSeconds, createdAt: nowSeconds, exp: payload.exp };
  return payload;
}

function revokeUser(state, user) {
  user.version += 1;
  for (const [id, session] of Object.entries(state.sessions)) {
    if (session.userId === user.id) delete state.sessions[id];
  }
  for (const [id, challenge] of Object.entries(state.challenges)) {
    if (challenge.userId === user.id || challenge.result?.sub === user.id) delete state.challenges[id];
  }
}

async function persistentRequest(options) {
  const {
    request, route, config, store, nowSeconds, randomBytesImpl,
    generateAuthenticationOptionsImpl, verifyAuthenticationResponseImpl,
    generateRegistrationOptionsImpl, verifyRegistrationResponseImpl,
  } = options;
  const operationConfig = { ...config, cookieName: `${config.cookieName}_challenge` };
  const body = request.method === "POST" ? parseJsonBody(request.body || "{}") : {};
  const protectedRoute = !["register/options", "register/verify", "challenge", "verify"].includes(route);
  let auth;
  if (protectedRoute) {
    auth = readAuthToken(request, config, nowSeconds, "session");
    if (request.method === "POST") requireCsrf(request, auth);
    persistedSession(await store.read(), auth, config, nowSeconds);
  }

  // Persistent fixed-window rate limits survive cold starts and multiple instances.
  // Every public verification attempt is counted, including malformed responses.
  if (["register/options", "register/verify", "challenge", "verify", "reauth/challenge", "reauth/verify",
    "passkeys/options", "passkeys/verify"].includes(route)) {
    const allowed = store.takeRateLimit
      ? await store.takeRateLimit(request.sourceIp, nowSeconds)
      : await store.mutate((state) => {
        pruneRegistry(state, nowSeconds);
        const keys = [{ key: "global", limit: 120 }];
        if (typeof request.sourceIp === "string") keys.push({ key: hash(request.sourceIp), limit: 20 });
        for (const { key, limit } of keys) {
          if (!state.rates[key]) state.rates[key] = { count: 0, exp: nowSeconds + 60 };
          if (state.rates[key].count >= limit) return false;
          state.rates[key].count += 1;
        }
        return true;
      });
    if (!allowed) throw new HttpError(429, "RATE_LIMITED", "Too many authentication attempts; retry later");
  }

  if (["register/options", "passkeys/options", "challenge", "reauth/challenge"].includes(route)) {
    const state = await store.read();
    const action = { "register/options": "register", "passkeys/options": "add", challenge: "login", "reauth/challenge": "reauth" }[route];
    let user;
    let invitation;
    let displayName;
    if (action === "register") {
      invitation = inviteFromToken(state, body.invitationToken, nowSeconds);
      displayName = label(body.displayName, "displayName");
      user = { id: invitation.invite.userId, displayName };
    } else if (action !== "login") {
      user = (action === "add" ? requireRecent : persistedSession)(state, auth, config, nowSeconds).user;
    }
    const isRegistration = ["register", "add"].includes(action);
    const credentialName = isRegistration ? label(body.credentialName || "My Passkey", "credentialName") : undefined;
    const publicKey = isRegistration
      ? await generateRegistrationOptionsImpl({
        rpName: "彦骁的笔记", rpID: config.rpID,
        userID: new Uint8Array(Buffer.from(user.id, "utf8")), userName: user.id, userDisplayName: user.displayName,
        attestationType: "none", timeout: 60_000,
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        excludeCredentials: userCredentials(state, user.id).map(({ id, transports }) => ({ id, transports })),
      })
      : await generateAuthenticationOptionsImpl({
        rpID: config.rpID, timeout: 60_000, userVerification: "required",
        // Discoverable login does not publish all users' credential IDs.
        ...(user ? { allowCredentials: userCredentials(state, user.id).map(({ id, transports }) => ({ id, transports })) } : {}),
      });
    const id = opaqueId(randomBytesImpl);
    const exp = nowSeconds + config.challengeTtlSeconds;
    await store.mutate((current) => {
      pruneRegistry(current, nowSeconds);
      if (invitation) inviteFromToken(current, body.invitationToken, nowSeconds);
      if (auth) (action === "add" ? requireRecent : persistedSession)(current, auth, config, nowSeconds);
      if (Object.keys(current.challenges).length >= 32) {
        throw new HttpError(429, "TOO_MANY_CHALLENGES", "Too many outstanding authentication challenges");
      }
      current.challenges[id] = {
        action, challenge: publicKey.challenge, exp, userId: user?.id,
        inviteHash: invitation?.key, displayName, credentialName,
        sessionId: auth?.sid, userVersion: user?.version,
      };
    });
    return jsonResponse(config, 200, { publicKey }, {
      "set-cookie": serializeCookie(operationConfig,
        encryptToken({ kind: "operation", id, exp }, config.currentSessionKey, randomBytesImpl), config.challengeTtlSeconds),
    });
  }

  if (["register/verify", "passkeys/verify", "verify", "reauth/verify"].includes(route)) {
    const action = { "register/verify": "register", "passkeys/verify": "add", verify: "login", "reauth/verify": "reauth" }[route];
    const operation = readAuthToken(request, operationConfig, nowSeconds, "operation");
    const response = body.credential ||
      (body.response && typeof body.response.id === "string" ? body.response : body);
    if (!response || typeof response.id !== "string" || response.id.length > 2048 || !BASE64URL_PATTERN.test(response.id)) {
      throw new HttpError(400, "INVALID_CREDENTIAL", "credential must be a WebAuthn response");
    }
    const fingerprint = hash(JSON.stringify(response));
    const getChallenge = (state) => {
      const challenge = state.challenges[operation.id];
      if (!challenge || challenge.exp <= nowSeconds || challenge.action !== action ||
          challenge.sessionId !== auth?.sid) {
        throw new HttpError(401, "INVALID_CHALLENGE", "Authentication challenge is invalid or expired");
      }
      return challenge;
    };
    const replayResult = (state, challenge) => {
      if (challenge.fingerprint !== fingerprint) {
        throw new HttpError(409, "CHALLENGE_USED", "This challenge has already been used");
      }
      const { user } = persistedSession(state, challenge.result, config, nowSeconds);
      if (auth) persistedSession(state, auth, config, nowSeconds);
      return { payload: challenge.result, user };
    };
    const respond = ({ payload, user }) => jsonResponse(config, 200, sessionResult(payload, user), {
      "set-cookie": serializeCookie(config, encryptToken(payload, config.currentSessionKey, randomBytesImpl), payload.exp - nowSeconds),
    });
    const state = await store.read();
    const challenge = getChallenge(state);
    if (challenge.result) return respond(replayResult(state, challenge));
    const isRegistration = ["register", "add"].includes(action);
    const credential = state.credentials[hash(response.id)];
    let verified;
    try {
      if (isRegistration) {
        verified = await verifyRegistrationResponseImpl({
          response, expectedChallenge: challenge.challenge,
          expectedOrigin: config.expectedOrigin, expectedRPID: config.rpID, requireUserVerification: true,
        });
        if (!verified.verified || !verified.registrationInfo?.userVerified) throw new Error();
      } else {
        if (!credential || (challenge.userId && credential.userId !== challenge.userId)) throw new Error();
        activeUser(state, credential.userId);
        if (credential.webauthnUserId && response.response?.userHandle &&
            response.response.userHandle !== credential.webauthnUserId) throw new Error();
        verified = await verifyAuthenticationResponseImpl({
          response, expectedChallenge: challenge.challenge, expectedOrigin: config.expectedOrigin,
          expectedRPID: config.rpID, credential: normalizeCredential(credential, "credential"), requireUserVerification: true,
        });
        if (!verified.verified || !verified.authenticationInfo?.userVerified) throw new Error();
      }
    } catch {
      throw new HttpError(401, "PASSKEY_VERIFICATION_FAILED", "Passkey verification failed");
    }
    const seed = { sid: opaqueId(randomBytesImpl), csrf: randomBytesImpl(32).toString("base64url") };
    const completed = await store.mutate((current) => {
      const pending = getChallenge(current);
      if (pending.result) return replayResult(current, pending);
      let user;
      if (action === "register") {
        const invite = current.invites[pending.inviteHash];
        if (!invite || invite.used || invite.exp <= nowSeconds || invite.userId !== pending.userId) {
          throw new HttpError(403, "INVALID_INVITATION", "Invitation is invalid or expired");
        }
        if (invite.kind === "recovery") {
          user = current.users[invite.userId];
          if (!user || user.status !== "recovering" || user.version !== invite.userVersion) {
            throw new HttpError(403, "INVALID_INVITATION", "Recovery invitation is no longer valid");
          }
          user.status = "active";
        } else {
          if (current.users[invite.userId] || Object.keys(current.users).length >= MAX_USERS) {
            throw new HttpError(409, "ACCOUNT_LIMIT", "Account exists or account limit reached");
          }
          user = { id: invite.userId, displayName: pending.displayName, role: invite.role,
            permissions: invite.permissions, status: "active", version: 1, createdAt: nowSeconds };
          current.users[user.id] = user;
        }
        invite.used = true;
      } else if (action === "add") {
        user = requireRecent(current, auth, config, nowSeconds).user;
      } else {
        const latest = current.credentials[hash(response.id)];
        if (!latest || latest.userId !== credential.userId || latest.publicKey !== credential.publicKey ||
            latest.counter !== credential.counter) {
          throw new HttpError(409, "CREDENTIAL_CHANGED", "Credential changed; start a new login");
        }
        user = activeUser(current, latest.userId);
        if (user.version !== state.users[credential.userId].version) {
          throw new HttpError(401, "UNAUTHENTICATED", "Account changed during authentication");
        }
        if (auth) persistedSession(current, auth, config, nowSeconds);
        const counter = verified.authenticationInfo.newCounter;
        if (!Number.isSafeInteger(counter) || counter < 0) throw new Error("Invalid authenticator counter");
        latest.counter = counter;
        latest.lastUsedAt = nowSeconds;
      }
      if (isRegistration) {
        const info = verified.registrationInfo;
        const saved = info.credential;
        if (!saved || saved.id !== response.id || !saved.publicKey?.length) throw new Error("Invalid verified credential");
        if (current.credentials[hash(saved.id)] || userCredentials(current, user.id).length >= MAX_PASSKEYS) {
          throw new HttpError(409, "CREDENTIAL_EXISTS_OR_LIMIT", "Credential already registered or Passkey limit reached");
        }
        const normalized = normalizeCredential({ ...saved, publicKey: Buffer.from(saved.publicKey).toString("base64url") }, "credential");
        current.credentials[hash(saved.id)] = {
          ...normalized, publicKey: Buffer.from(normalized.publicKey).toString("base64url"), userId: user.id,
          webauthnUserId: Buffer.from(user.id).toString("base64url"),
          name: pending.credentialName, createdAt: nowSeconds, deviceType: info.credentialDeviceType,
          backedUp: info.credentialBackedUp,
        };
      }
      let payload;
      if (auth) {
        payload = auth;
        if (action === "reauth") current.sessions[auth.sid].authTime = nowSeconds;
      } else payload = issueSession(current, user, response.id, config, nowSeconds, seed);
      pending.fingerprint = fingerprint;
      pending.result = payload;
      return { payload, user };
    });
    return respond(completed);
  }

  const state = await store.read();
  const { user } = persistedSession(state, auth, config, nowSeconds);
  if (route === "session") return jsonResponse(config, 200, sessionResult(auth, user));
  if (route === "sign") {
    if (!hasPrivateResourceAccess(user)) {
      throw new HttpError(403, "MISSING_PERMISSION", "Private resource access has not been granted");
    }
    return jsonResponse(config, 200, {
      expiresAt: nowSeconds + config.cdnUrlTtlSeconds,
      resources: signedResources(body, config, nowSeconds, randomBytesImpl),
    });
  }
  if (route === "passkeys") {
    return jsonResponse(config, 200, { credentials: userCredentials(state, user.id)
      .map(({ id, name, createdAt, lastUsedAt, deviceType, backedUp }) => ({ id, name, createdAt, lastUsedAt, deviceType, backedUp })) });
  }
  if (["passkeys/rename", "passkeys/remove"].includes(route)) {
    if (typeof body.credentialId !== "string") throw new HttpError(400, "INVALID_CREDENTIAL", "credentialId is required");
    const name = route === "passkeys/rename" ? label(body.name, "name") : undefined;
    await store.mutate((current) => {
      const account = requireRecent(current, auth, config, nowSeconds).user;
      const key = hash(body.credentialId);
      const target = current.credentials[key];
      if (!target || target.userId !== account.id) throw new HttpError(404, "NOT_FOUND", "Credential not found");
      if (route === "passkeys/rename") target.name = name;
      else {
        if (userCredentials(current, account.id).length <= 1) {
          throw new HttpError(409, "LAST_PASSKEY", "Add another Passkey before removing the last one");
        }
        delete current.credentials[key];
        revokeUser(current, account);
      }
    });
    return jsonResponse(config, 200, { updated: true, loginRequired: route === "passkeys/remove" },
      route === "passkeys/remove" ? { "set-cookie": clearCookie(config) } : {});
  }
  if (route === "logout") {
    await store.mutate((current) => { delete current.sessions[auth.sid]; });
    return jsonResponse(config, 200, { authenticated: false }, { "set-cookie": clearCookie(config) });
  }
  throw new HttpError(404, "NOT_FOUND", "Route does not exist");
}

/** Trusted CLI only. No HTTP route exposes initialization, invitations or recovery. */
export async function administer({ store, command, userId, displayName = "Owner", permissions = [],
  invitationHash, credentials = [], ttlSeconds = 86400, nowSeconds = Math.floor(Date.now() / 1000), randomBytesImpl = randomBytes }) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 300 || ttlSeconds > 604800) throw new Error("Invitation TTL must be 300..604800 seconds");
  if (!Array.isArray(permissions) || permissions.some((value) => !PRIVATE_RESOURCE_PERMISSIONS.has(value))) throw new Error("Invalid permissions");
  const allowed = ["bootstrap", "reissue-bootstrap", "import-owner", "invite", "revoke-invite", "disable", "enable", "permissions", "recover", "list"];
  if (!allowed.includes(command)) throw new Error("Unknown administrative command");
  const token = randomBytesImpl(INVITATION_TOKEN_BYTES).toString("base64url");
  const tokenHash = hash(token);
  const newUserId = opaqueId(randomBytesImpl);
  return store.mutate((state) => {
    pruneRegistry(state, nowSeconds);
    if (["bootstrap", "import-owner"].includes(command)) {
      if (state.initialized) throw new Error("Registry already initialized; use owner recovery if needed");
      state.initialized = true;
      state.bootstrapUserId = command === "import-owner" ? "owner" : newUserId;
      if (command === "import-owner") {
        if (!credentials.length || credentials.length > MAX_PASSKEYS) throw new Error("Provide 1..8 existing credentials");
        state.users.owner = { id: "owner", displayName: label(displayName, "displayName"), role: "owner",
          permissions: ["private-resources", "english-learning"], status: "active", version: 1, createdAt: nowSeconds };
        for (const raw of credentials) {
          const credential = normalizeCredential(raw, "credential");
          const key = hash(credential.id);
          if (state.credentials[key]) throw new Error("Duplicate credential");
          state.credentials[key] = { ...credential, publicKey: Buffer.from(credential.publicKey).toString("base64url"),
            webauthnUserId: raw.webauthnUserId,
            userId: "owner", name: "Imported Passkey", createdAt: nowSeconds };
        }
        return { userId: "owner", imported: credentials.length };
      }
    } else if (!state.initialized) throw new Error("Registry must be initialized by the owner");

    if (command === "reissue-bootstrap") {
      if (!state.bootstrapUserId || state.users[state.bootstrapUserId]) {
        throw new Error("Owner already enrolled; use recovery instead");
      }
      for (const [id, invite] of Object.entries(state.invites)) {
        if (invite.userId === state.bootstrapUserId) delete state.invites[id];
      }
    }

    if (command === "list") return {
      users: Object.values(state.users).map(({ id, displayName: name, status, role, permissions: grants }) => ({ id, displayName: name, status, role, permissions: grants })),
      invites: Object.entries(state.invites).map(([id, invite]) => ({ id, userId: invite.userId, kind: invite.kind, exp: invite.exp, used: !!invite.used })),
    };
    if (command === "revoke-invite") {
      if (!Object.hasOwn(state.invites, invitationHash || "")) throw new Error("Unknown invitation hash");
      delete state.invites[invitationHash];
      return { revoked: true };
    }
    const user = Object.hasOwn(state.users, userId || "") ? state.users[userId] : undefined;
    if (["disable", "enable", "permissions", "recover"].includes(command) && !user) throw new Error("Unknown user ID");
    if (["disable", "enable", "permissions"].includes(command)) {
      if (command === "enable" && !userCredentials(state, user.id).length) throw new Error("Recover a Passkey before enabling this account");
      if (command === "permissions") user.permissions = [...new Set(permissions)];
      else user.status = command === "disable" ? "disabled" : "active";
      revokeUser(state, user);
      for (const [id, invite] of Object.entries(state.invites)) {
        if (invite.userId === user.id) delete state.invites[id];
      }
      return { userId: user.id, status: user.status, permissions: user.permissions };
    }
    if (Object.keys(state.invites).length >= 20) throw new Error("Invitation limit reached");
    if (command === "recover") {
      revokeUser(state, user);
      user.status = "recovering";
      for (const [id, credential] of Object.entries(state.credentials)) {
        if (credential.userId === user.id) delete state.credentials[id];
      }
      for (const [id, invite] of Object.entries(state.invites)) {
        if (invite.userId === user.id) delete state.invites[id];
      }
    }
    const ownerEnrollment = ["bootstrap", "reissue-bootstrap"].includes(command);
    const targetId = ownerEnrollment ? state.bootstrapUserId : user?.id || newUserId;
    state.invites[tokenHash] = {
      kind: command === "recover" ? "recovery" : "registration", userId: targetId,
      role: ownerEnrollment ? "owner" : "member",
      permissions: ownerEnrollment ? ["private-resources", "english-learning"] : [...new Set(permissions)],
      userVersion: user?.version, exp: nowSeconds + ttlSeconds, used: false,
    };
    return { invitationToken: token, invitationHash: tokenHash, userId: targetId, expiresAt: nowSeconds + ttlSeconds };
  }, { initialize: ["bootstrap", "import-owner"].includes(command) });
}

export const handler = createHandler();

export const __test = {
  decryptToken,
  encryptToken,
  loadConfig,
  parseEvent,
  signCdnPath,
  signedResources,
};
