const API_BASE = "/api/private-auth";

export interface PrivateAuthUser {
  id: string;
  displayName: string;
  role: "owner" | "member";
  permissions: string[];
}

export interface PrivateAuthSession {
  authenticated: true;
  csrfToken: string;
  expiresAt: number;
  user: PrivateAuthUser;
}

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface RequestOptions {
  body?: unknown;
  csrfToken?: string;
  method?: "GET" | "POST";
  signal?: AbortSignal;
}

export class PrivateAuthApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PrivateAuthApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = new Headers({ Accept: "application/json" });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.csrfToken) {
    headers.set("X-CSRF-Token", options.csrfToken);
  }

  const response = await fetch(`${API_BASE}/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
  });

  let payload: T | ApiErrorBody;
  try {
    payload = await response.json() as T | ApiErrorBody;
  } catch {
    throw new PrivateAuthApiError(
      response.status,
      "INVALID_RESPONSE",
      "认证服务返回了无法解析的响应",
    );
  }

  if (!response.ok) {
    const error = payload as ApiErrorBody;
    throw new PrivateAuthApiError(
      response.status,
      error.code ?? "REQUEST_FAILED",
      error.message ?? "认证请求失败",
    );
  }

  return payload as T;
}

export interface PublicKeyOptions<T> {
  publicKey: T;
}

export function getPrivateAuthSession(signal?: AbortSignal): Promise<PrivateAuthSession> {
  return request<PrivateAuthSession>("session", { signal });
}

export function beginPasskeyLogin<T>(): Promise<PublicKeyOptions<T>> {
  return request<PublicKeyOptions<T>>("challenge", { body: {} });
}

export function verifyPasskeyLogin(credential: unknown): Promise<PrivateAuthSession> {
  return request<PrivateAuthSession>("verify", { body: { credential } });
}

export function beginPasskeyRegistration<T>(body: {
  invitationToken: string;
  displayName: string;
  credentialName: string;
}): Promise<PublicKeyOptions<T>> {
  return request<PublicKeyOptions<T>>("register/options", { body });
}

export function verifyPasskeyRegistration(credential: unknown): Promise<PrivateAuthSession> {
  return request<PrivateAuthSession>("register/verify", { body: { credential } });
}

export function logoutPrivateAuth(session: PrivateAuthSession): Promise<{ authenticated: false }> {
  return request<{ authenticated: false }>("logout", {
    body: {},
    csrfToken: session.csrfToken,
  });
}
