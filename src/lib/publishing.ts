import { PRIVATE_AUTH_API_BASE } from "@/lib/privateAuthApi";
import { notifyPrivateAuthInvalidated } from "@/lib/privateAuthEvents";
import type { PrivateAuthSession } from "@/lib/privateAuth";
export interface PublishingAsset { id: string; name: string; kind: "image" | "video"; url: string }
export interface PublishingUploadFormat { extension: string; contentType: string; kind: "image" | "video"; maxBytes: number }
export interface PublishingEntry { id: string; version: number; title: string; summary: string; body: string; type: "article" | "moment"; assetIds: string[]; published: unknown; publishedAt?: string; media?: PublishingAsset[] }
export async function publishingRequest<T>(operation: string, body: unknown, session: PrivateAuthSession): Promise<T> {
  const response = await fetch(`${PRIVATE_AUTH_API_BASE}/publishing/${operation}`, { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (response.status === 401) notifyPrivateAuthInvalidated();
  if (!response.ok) throw new Error(payload.message ?? "操作失败");
  return payload as T;
}
export async function getPublicContent(signal?: AbortSignal): Promise<PublishingEntry[]> {
  const response = await fetch(`${PRIVATE_AUTH_API_BASE}/public/content`, { credentials: "omit", cache: "no-store", signal });
  if (!response.ok) throw new Error("公开内容读取失败，请稍后重试");
  return (await response.json()).entries;
}
