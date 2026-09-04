import { notifyPrivateAuthInvalidated } from "@/lib/privateAuthEvents";

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
  /** Unix timestamp in seconds, matching the Function Compute API contract. */
  expiresAt: number;
  user: PrivateAuthUser;
}

export interface SignedPrivateResources {
  expiresAt: number;
  resources: Record<string, string>;
}

export interface PrivateResourceUploadFile {
  contentType: "audio/mpeg" | "text/plain" | "application/pdf";
  bytes: number;
}

export interface PrivateLearningUploadRequest {
  collectionId: string;
  itemId?: string;
  title: string;
  publishedAt: string;
  recommendedDate: string;
  sourcePage?: string;
  reason: string;
  difficulty: string;
  tags: string[];
  files: {
    audio: PrivateResourceUploadFile;
    transcriptText: PrivateResourceUploadFile;
    transcriptPdf?: PrivateResourceUploadFile;
  };
}

export interface PrivateFileUploadRequest {
  collectionId: string;
  file: { originalName: string; bytes: number };
}

export type PrivateResourceUploadRequest = PrivateLearningUploadRequest | PrivateFileUploadRequest;

export interface PrivateResourceUploadTarget {
  path: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface PrivateResourceUploadSession {
  uploadToken: string;
  expiresAt: number;
  itemId: string;
  files: Record<string, PrivateResourceUploadTarget>;
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
    if (response.status === 401) notifyPrivateAuthInvalidated();
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

export function signPrivateResourceCatalog(
  session: PrivateAuthSession,
  signal?: AbortSignal,
): Promise<SignedPrivateResources> {
  return request<SignedPrivateResources>("sign", {
    body: { resource: "catalog" },
    csrfToken: session.csrfToken,
    signal,
  });
}

export function signPrivateResourcePaths(
  session: PrivateAuthSession,
  paths: Record<string, string>,
  signal?: AbortSignal,
): Promise<SignedPrivateResources> {
  return request<SignedPrivateResources>("sign", {
    body: { paths },
    csrfToken: session.csrfToken,
    signal,
  });
}

export function signLegacyPrivateLearningIndex(
  session: PrivateAuthSession,
  signal?: AbortSignal,
): Promise<SignedPrivateResources> {
  return request<SignedPrivateResources>("sign", {
    body: { resource: "index" },
    csrfToken: session.csrfToken,
    signal,
  });
}

export function signLegacyPrivateLearningEpisode(
  session: PrivateAuthSession,
  episodeId: string,
  signal?: AbortSignal,
): Promise<SignedPrivateResources> {
  return request<SignedPrivateResources>("sign", {
    body: { episodeId },
    csrfToken: session.csrfToken,
    signal,
  });
}

export function beginPrivateResourceUpload(
  session: PrivateAuthSession,
  body: PrivateResourceUploadRequest,
  signal?: AbortSignal,
): Promise<PrivateResourceUploadSession> {
  return request<PrivateResourceUploadSession>("uploads/init", {
    body,
    csrfToken: session.csrfToken,
    signal,
  });
}

export function completePrivateResourceUpload(
  session: PrivateAuthSession,
  uploadToken: string,
  signal?: AbortSignal,
): Promise<{ published: true; collectionId: string; itemId: string }> {
  return request("uploads/complete", {
    body: { uploadToken },
    csrfToken: session.csrfToken,
    signal,
  });
}

export function createPrivateResourceCollection(
  session: PrivateAuthSession,
  body: { title: string; description: string; tags: string[] },
  signal?: AbortSignal,
): Promise<{ created: true; collection: { collectionId: string } }> {
  return request("collections/create", {
    body,
    csrfToken: session.csrfToken,
    signal,
  });
}

export interface PrivateClipboardEntry {
  id: string;
  text: string;
  createdAt: string;
}

export interface PrivateClipboard {
  schemaVersion: 1;
  updatedAt: string | null;
  entries: PrivateClipboardEntry[];
}

export function deletePrivateResourceCollection(
  session: PrivateAuthSession,
  collectionId: string,
): Promise<{ deleted: true; collectionId: string }> {
  return request("collections/delete", {
    body: { collectionId },
    csrfToken: session.csrfToken,
  });
}

export function deletePrivateResourceFile(
  session: PrivateAuthSession,
  collectionId: string,
  itemId: string,
): Promise<{ deleted: true; collectionId: string; itemId: string }> {
  return request("files/delete", {
    body: { collectionId, itemId },
    csrfToken: session.csrfToken,
  });
}

export function getPrivateClipboard(
  session: PrivateAuthSession,
  signal?: AbortSignal,
): Promise<PrivateClipboard> {
  return request("clipboard/get", { body: {}, csrfToken: session.csrfToken, signal });
}

export function savePrivateClipboardText(
  session: PrivateAuthSession,
  text: string,
): Promise<{ saved: true; entry: PrivateClipboardEntry }> {
  return request("clipboard/save", { body: { text }, csrfToken: session.csrfToken });
}

export function deletePrivateClipboardEntry(
  session: PrivateAuthSession,
  id: string,
): Promise<{ deleted: true }> {
  return request("clipboard/delete", { body: { id }, csrfToken: session.csrfToken });
}
