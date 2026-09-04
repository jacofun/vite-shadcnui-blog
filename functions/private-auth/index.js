import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  __test as coreTest,
  administer,
  createHandler as createCoreHandler,
  createOssEventStore,
  createPrivateResourceContentStore,
  createRegistryStore,
} from "./core.js";

const DEVICE_AUTHORIZATION_TTL_SECONDS = 60;
const MAX_DEVICE_AUTHORIZATIONS = 12;
const DEVICE_TOKEN_ID_PATTERN = /^[a-f0-9]{48}$/;
const DEVICE_TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

class DeviceAuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "DeviceAuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual || "", "utf8");
  const expectedBuffer = Buffer.from(expected || "", "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeRoute(path, cookiePath) {
  const normalized = path.replace(/\/+$/, "") || "/";
  const apiPrefix = cookiePath.replace(/\/+$/, "");
  if (normalized === "/challenge" || normalized === `${apiPrefix}/challenge`) return "challenge";
  if (normalized === "/verify" || normalized === `${apiPrefix}/verify`) return "verify";
  return null;
}

function parseBody(body) {
  if (body && typeof body === "object") return body;
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new DeviceAuthError(400, "INVALID_JSON", "Request body must be a JSON object");
  }
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

function requireGatewayAndOrigin(request, config) {
  if (!constantTimeEqual(request.headers["x-origin-verify"], config.originVerifyKey)) {
    throw new DeviceAuthError(403, "FORBIDDEN", "Request did not pass the configured CDN origin");
  }
  if (!constantTimeEqual(request.headers.origin, config.expectedOrigin)) {
    throw new DeviceAuthError(403, "INVALID_ORIGIN", "Request origin is not allowed");
  }
}

function ensureDeviceCollection(state) {
  if (state.deviceAuthorizations === undefined) state.deviceAuthorizations = {};
  if (!state.deviceAuthorizations || typeof state.deviceAuthorizations !== "object" ||
      Array.isArray(state.deviceAuthorizations)) {
    throw new DeviceAuthError(503, "INVALID_AUTH_STORE", "Authentication store is invalid");
  }
  return state.deviceAuthorizations;
}

function pruneDeviceAuthorizations(state, nowSeconds) {
  const authorizations = ensureDeviceCollection(state);
  for (const [id, authorization] of Object.entries(authorizations)) {
    if (!Number.isSafeInteger(authorization?.exp) || authorization.exp <= nowSeconds) {
      delete authorizations[id];
    }
  }
  return authorizations;
}

function createDeviceToken(id, randomBytesImpl) {
  return `${id}.${randomBytesImpl(32).toString("base64url")}`;
}

function parseDeviceToken(token) {
  if (typeof token !== "string" || token.length > 128) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !DEVICE_TOKEN_ID_PATTERN.test(parts[0]) ||
      !DEVICE_TOKEN_SECRET_PATTERN.test(parts[1])) return null;
  return { id: parts[0], secret: parts[1] };
}

function deviceAuthorizationFromToken(state, token, kind, nowSeconds) {
  const parsed = parseDeviceToken(token);
  const authorizations = ensureDeviceCollection(state);
  const authorization = parsed ? authorizations[parsed.id] : null;
  const expectedHash = kind === "approval" ? authorization?.approvalHash : authorization?.deviceHash;
  if (!parsed || !authorization || !expectedHash || !constantTimeEqual(hash(parsed.secret), expectedHash)) {
    throw new DeviceAuthError(404, "INVALID_DEVICE_AUTHORIZATION", "Device authorization is invalid");
  }
  if (!Number.isSafeInteger(authorization.exp) || authorization.exp <= nowSeconds) {
    throw new DeviceAuthError(410, "DEVICE_AUTHORIZATION_EXPIRED", "Device authorization has expired");
  }
  return { id: parsed.id, authorization };
}

function activeUser(state, userId) {
  const user = state.users?.[userId];
  if (!user || user.status !== "active") {
    throw new DeviceAuthError(401, "UNAUTHENTICATED", "Account is not active");
  }
  return user;
}

function validCredential(state, credentialId, userId) {
  if (typeof credentialId !== "string") return false;
  const credential = state.credentials?.[hash(credentialId)];
  return !!credential && credential.userId === userId;
}

function sessionResult(payload, user) {
  return {
    authenticated: true,
    csrfToken: payload.csrf,
    expiresAt: payload.exp,
    user: {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      permissions: user.permissions,
    },
  };
}

function issueDeviceSession(state, authorization, config, nowSeconds, randomBytesImpl) {
  const user = activeUser(state, authorization.userId);
  if (user.version !== authorization.userVersion ||
      !validCredential(state, authorization.credentialId, user.id)) {
    throw new DeviceAuthError(401, "UNAUTHENTICATED", "The approving account is no longer valid");
  }

  const existing = Object.entries(state.sessions)
    .filter(([, session]) => session.userId === user.id)
    .sort((left, right) => left[1].createdAt - right[1].createdAt);
  while (existing.length >= 8) delete state.sessions[existing.shift()[0]];

  const sid = randomBytesImpl(24).toString("hex");
  const csrf = randomBytesImpl(32).toString("base64url");
  const payload = {
    kind: "session",
    store: "oss",
    sub: user.id,
    sid,
    version: config.sessionVersion,
    userVersion: user.version,
    csrf,
    iat: nowSeconds,
    exp: nowSeconds + config.sessionTtlSeconds,
  };
  state.sessions[sid] = {
    userId: user.id,
    credentialId: authorization.credentialId,
    authTime: nowSeconds,
    createdAt: nowSeconds,
    exp: payload.exp,
  };
  return { payload, user };
}

function completedDeviceSession(state, authorization, config, nowSeconds) {
  const payload = authorization.result;
  if (!payload || payload.kind !== "session" || payload.store !== "oss" ||
      payload.version !== config.sessionVersion || !payload.sid || !payload.csrf ||
      !Number.isSafeInteger(payload.exp) || payload.exp <= nowSeconds) return null;
  const user = activeUser(state, payload.sub);
  const session = state.sessions?.[payload.sid];
  if (!session || session.userId !== user.id || session.exp <= nowSeconds ||
      payload.userVersion !== user.version || !validCredential(state, session.credentialId, user.id)) return null;
  return { payload, user };
}

function sessionPayloadFromCoreResponse(response, config, nowSeconds) {
  const setCookie = response?.headers?.["set-cookie"];
  if (typeof setCookie !== "string") {
    throw new DeviceAuthError(500, "INTERNAL_ERROR", "Verified session cookie is missing");
  }
  const pair = setCookie.split(";", 1)[0];
  const separator = pair.indexOf("=");
  if (separator < 1 || pair.slice(0, separator) !== config.cookieName) {
    throw new DeviceAuthError(500, "INTERNAL_ERROR", "Verified session cookie is invalid");
  }
  const payload = coreTest.decryptToken(
    pair.slice(separator + 1),
    [config.currentSessionKey, config.previousSessionKey],
  );
  if (!payload || payload.kind !== "session" || payload.store !== "oss" ||
      !payload.sid || !payload.sub || !payload.csrf ||
      !Number.isSafeInteger(payload.exp) || payload.exp <= nowSeconds) {
    throw new DeviceAuthError(500, "INTERNAL_ERROR", "Verified session token is invalid");
  }
  return payload;
}

async function takeDeviceStartRateLimit(store, request, nowSeconds) {
  if (store.takeRateLimit) {
    if (!await store.takeRateLimit(request.sourceIp, nowSeconds)) {
      throw new DeviceAuthError(429, "RATE_LIMITED", "Too many authentication attempts; retry later");
    }
    return;
  }

  const allowed = await store.mutate((state) => {
    const rates = state.rates || (state.rates = {});
    for (const [key, value] of Object.entries(rates)) {
      if (value.exp <= nowSeconds) delete rates[key];
    }
    const keys = [{ key: "device-global", limit: 120 }];
    if (typeof request.sourceIp === "string" && request.sourceIp) {
      keys.push({ key: `device-${hash(request.sourceIp)}`, limit: 20 });
    }
    for (const { key, limit } of keys) {
      if (!rates[key]) rates[key] = { count: 0, exp: nowSeconds + 60 };
      if (rates[key].count >= limit) return false;
      rates[key].count += 1;
    }
    return true;
  });
  if (!allowed) {
    throw new DeviceAuthError(429, "RATE_LIMITED", "Too many authentication attempts; retry later");
  }
}

async function beginDeviceAuthorization({ store, request, config, nowSeconds, randomBytesImpl }) {
  await takeDeviceStartRateLimit(store, request, nowSeconds);
  const id = randomBytesImpl(24).toString("hex");
  const approvalToken = createDeviceToken(id, randomBytesImpl);
  const deviceToken = createDeviceToken(id, randomBytesImpl);
  const approval = parseDeviceToken(approvalToken);
  const device = parseDeviceToken(deviceToken);
  const expiresAt = nowSeconds + DEVICE_AUTHORIZATION_TTL_SECONDS;

  await store.mutate((state) => {
    const authorizations = pruneDeviceAuthorizations(state, nowSeconds);
    if (Object.keys(authorizations).length >= MAX_DEVICE_AUTHORIZATIONS) {
      throw new DeviceAuthError(429, "TOO_MANY_DEVICE_AUTHORIZATIONS", "Too many outstanding device authorizations");
    }
    authorizations[id] = {
      status: "pending",
      approvalHash: hash(approval.secret),
      deviceHash: hash(device.secret),
      createdAt: nowSeconds,
      exp: expiresAt,
    };
  });

  return jsonResponse(config, 200, {
    status: "pending",
    approvalToken,
    deviceToken,
    expiresAt,
  });
}

async function completeDeviceAuthorization({ store, body, config, nowSeconds, randomBytesImpl }) {
  const snapshot = await store.read();
  const { authorization } = deviceAuthorizationFromToken(
    snapshot,
    body.deviceToken,
    "device",
    nowSeconds,
  );
  if (authorization.status === "pending") {
    return jsonResponse(config, 200, { status: "pending", expiresAt: authorization.exp });
  }
  if (authorization.status !== "approved") {
    throw new DeviceAuthError(404, "INVALID_DEVICE_AUTHORIZATION", "Device authorization is invalid");
  }

  const completed = await store.mutate((state) => {
    pruneDeviceAuthorizations(state, nowSeconds);
    const { authorization: current } = deviceAuthorizationFromToken(
      state,
      body.deviceToken,
      "device",
      nowSeconds,
    );
    if (current.status !== "approved") {
      throw new DeviceAuthError(409, "DEVICE_AUTHORIZATION_PENDING", "Device authorization has not been approved");
    }
    const replay = completedDeviceSession(state, current, config, nowSeconds);
    if (replay) return replay;
    const issued = issueDeviceSession(state, current, config, nowSeconds, randomBytesImpl);
    current.result = issued.payload;
    current.completedAt = nowSeconds;
    return issued;
  });

  return jsonResponse(config, 200, sessionResult(completed.payload, completed.user), {
    "set-cookie": serializeCookie(
      config,
      coreTest.encryptToken(completed.payload, config.currentSessionKey, randomBytesImpl),
      completed.payload.exp - nowSeconds,
    ),
  });
}

async function validateApprovalBeforePasskey({ store, approvalToken, nowSeconds }) {
  const state = await store.read();
  const { authorization } = deviceAuthorizationFromToken(
    state,
    approvalToken,
    "approval",
    nowSeconds,
  );
  if (!["pending", "approved"].includes(authorization.status)) {
    throw new DeviceAuthError(404, "INVALID_DEVICE_AUTHORIZATION", "Device authorization is invalid");
  }
}

async function approveAfterPasskey({ store, approvalToken, response, config, nowSeconds }) {
  const payload = sessionPayloadFromCoreResponse(response, config, nowSeconds);
  await store.mutate((state) => {
    pruneDeviceAuthorizations(state, nowSeconds);
    const { authorization } = deviceAuthorizationFromToken(
      state,
      approvalToken,
      "approval",
      nowSeconds,
    );
    const user = activeUser(state, payload.sub);
    const session = state.sessions?.[payload.sid];
    if (!session || session.userId !== user.id || session.exp <= nowSeconds ||
        payload.userVersion !== user.version || !validCredential(state, session.credentialId, user.id)) {
      throw new DeviceAuthError(401, "UNAUTHENTICATED", "Verified session is no longer valid");
    }
    if (authorization.status === "approved") {
      if (authorization.userId !== user.id) {
        throw new DeviceAuthError(409, "DEVICE_AUTHORIZATION_USED", "Device authorization was approved by another account");
      }
      return;
    }
    if (authorization.status !== "pending") {
      throw new DeviceAuthError(404, "INVALID_DEVICE_AUTHORIZATION", "Device authorization is invalid");
    }
    authorization.status = "approved";
    authorization.userId = user.id;
    authorization.userVersion = user.version;
    authorization.credentialId = session.credentialId;
    authorization.approvedAt = nowSeconds;
  });
}

function wrapperErrorResponse(error, config) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
  const message = statusCode >= 500
    ? "Private authentication service is unavailable"
    : error?.message || "Authentication request failed";
  return jsonResponse(config, statusCode, { code, message });
}

export function createHandler(options = {}) {
  const env = options.env || process.env;
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const randomBytesImpl = options.randomBytesImpl || randomBytes;
  const baseCoreHandler = createCoreHandler(options);

  return async function deviceAwarePrivateAuthHandler(event, context = {}) {
    let config;
    try {
      config = coreTest.loadConfig(env);
      if (config.storeMode !== "oss") return baseCoreHandler(event, context);

      const request = coreTest.parseEvent(event);
      const route = normalizeRoute(request.path, config.cookiePath);
      if (!route || request.method !== "POST") return baseCoreHandler(event, context);
      const body = parseBody(request.body);
      const isDeviceStart = route === "challenge" && body.deviceAuthorization === true;
      const isDeviceCompletion = route === "verify" && typeof body.deviceToken === "string";
      const approvalToken = route === "verify" && typeof body.approvalToken === "string"
        ? body.approvalToken
        : "";
      if (!isDeviceStart && !isDeviceCompletion && !approvalToken) {
        return baseCoreHandler(event, context);
      }

      requireGatewayAndOrigin(request, config);
      const nowSeconds = now();
      const store = options.store || await createOssEventStore({ env, context });

      if (isDeviceStart) {
        return await beginDeviceAuthorization({
          store,
          request,
          config,
          nowSeconds,
          randomBytesImpl,
        });
      }

      if (isDeviceCompletion) {
        return await completeDeviceAuthorization({
          store,
          body,
          config,
          nowSeconds,
          randomBytesImpl,
        });
      }

      await validateApprovalBeforePasskey({ store, approvalToken, nowSeconds });
      const delegated = createCoreHandler({ ...options, env, store });
      const response = await delegated(event, context);
      if (response.statusCode !== 200) return response;
      await approveAfterPasskey({
        store,
        approvalToken,
        response,
        config,
        nowSeconds,
      });
      return response;
    } catch (error) {
      const responseConfig = config || {
        expectedOrigin: env.WEBAUTHN_ORIGIN || "https://yanxiao.me",
      };
      return wrapperErrorResponse(error, responseConfig);
    }
  };
}

export {
  administer,
  createOssEventStore,
  createPrivateResourceContentStore,
  createRegistryStore,
};

export const __test = {
  ...coreTest,
  parseDeviceToken,
};

export const handler = createHandler();
