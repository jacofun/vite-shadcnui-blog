export type PrivateFileMediaType = "audio" | "video" | "file";

export interface PrivateFileItem {
  schemaVersion: 1;
  itemId: string;
  originalName: string;
  mediaType: PrivateFileMediaType;
  format: string;
  contentType: string;
  bytes: number;
  objectPath: string;
  uploadedAt: string;
  etag: string;
  metadataPath?: string;
}

export interface PrivateFileIndex {
  schemaVersion: 1;
  updatedAt: string | null;
  items: PrivateFileItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrivateFileItem(value: unknown): value is PrivateFileItem {
  return isRecord(value) && value.schemaVersion === 1 &&
    typeof value.itemId === "string" &&
    typeof value.originalName === "string" &&
    ["audio", "video", "file"].includes(String(value.mediaType)) &&
    typeof value.format === "string" &&
    typeof value.contentType === "string" &&
    Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0 &&
    typeof value.objectPath === "string" && value.objectPath.startsWith("/private/") &&
    typeof value.uploadedAt === "string" && typeof value.etag === "string";
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`私人文件读取失败（${response.status}）`);
  return response.json();
}

export async function fetchPrivateFileIndex(url: string, signal?: AbortSignal): Promise<PrivateFileIndex> {
  const value = await fetchJson(url, signal);
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      !Array.isArray(value.items) || !value.items.every(isPrivateFileItem)) {
    throw new Error("私人文件索引格式不正确");
  }
  return value as unknown as PrivateFileIndex;
}

export async function fetchPrivateFileItem(url: string, signal?: AbortSignal): Promise<PrivateFileItem> {
  const value = await fetchJson(url, signal);
  if (!isPrivateFileItem(value)) throw new Error("私人文件信息格式不正确");
  return value;
}

export function formatFileBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
