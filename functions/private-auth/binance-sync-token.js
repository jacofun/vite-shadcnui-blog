import { createHash, createPrivateKey, randomUUID, sign } from "node:crypto";

export class BinanceSyncTokenError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Shared FC-domain credential for trade sync and market analysis, never a site session.
// Keep the legacy audience/scope to match the existing native JWT policy.
export function issueBinanceSyncToken(options) {
  return issueTicket(options, "trading:sync");
}

export function issueBinanceOrderToken(options, input) {
  if (options.user?.role !== "owner") {
    throw new BinanceSyncTokenError(403, "MISSING_PERMISSION", "只有站点所有者可以获取订单凭证");
  }
  if (options.env.BINANCE_ORDER_TICKETS_ENABLED !== "true") {
    throw new BinanceSyncTokenError(503, "BINANCE_ORDER_TICKET_DISABLED", "订单凭证尚未启用");
  }
  if (["preview", "status"].includes(input.action) && Object.keys(input).length === 1) {
    return issueTicket(options, "trading:orders:read");
  }
  if (input.action === "submit" && Object.keys(input).length === 2 &&
      typeof input.draft === "string" && /^[A-Za-z0-9_-]{1,1500}\.[A-Za-z0-9_-]{43}$/.test(input.draft)) {
    const intent = createHash("sha256").update(input.draft).digest("hex");
    return issueTicket(options, "trading:orders:submit-protected", intent);
  }
  throw new BinanceSyncTokenError(400, "INVALID_ORDER_TICKET", "订单凭证参数无效");
}

function issueTicket({ user, env, nowSeconds }, scope, intent) {
  if (user?.role !== "owner") {
    throw new BinanceSyncTokenError(403, "MISSING_PERMISSION", "只有站点所有者可以同步币安记录");
  }
  try {
    const key = createPrivateKey((env.BINANCE_SYNC_PRIVATE_KEY || "").replace(/\\n/g, "\n"));
    const kid = env.BINANCE_SYNC_KEY_ID?.trim() || "trade-sync-v1";
    const issuer = env.BINANCE_SYNC_ISSUER?.trim() || "https://www.yanxiao.me";
    const audience = env.BINANCE_SYNC_AUDIENCE?.trim() || "binance-trade-sync";
    const url = new URL(env.BINANCE_SYNC_URL?.trim() || "https://yanxiao.me/trade/api/sync");
    if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails.modulusLength < 2048 ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(kid) || issuer.length > 256 || audience.length > 128 ||
      url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !user.id) {
      throw new Error("Invalid signing settings");
    }
    const expiresAt = nowSeconds + (intent ? 30 : 120);
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = encode({ alg: "RS256", typ: "JWT", kid });
    const payload = encode({ iss: issuer, aud: audience, sub: user.id, scope, ...(intent ? { intent } : {}),
      iat: nowSeconds, exp: expiresAt, jti: randomUUID() });
    const data = `${header}.${payload}`;
    const signature = sign("RSA-SHA256", Buffer.from(data), key).toString("base64url");
    return { token: `${data}.${signature}`, expiresAt, syncUrl: url.href };
  } catch {
    throw new BinanceSyncTokenError(503, "BINANCE_SYNC_UNAVAILABLE", "币安同步签名尚未配置，请检查北京函数的 BINANCE_SYNC 配置");
  }
}
