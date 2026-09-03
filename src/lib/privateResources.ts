import {
  PrivateAuthApiError,
  signPrivateResourceCatalog,
  type PrivateAuthSession,
} from "@/lib/privateAuth";

export interface PrivateResourceCollection {
  collectionId: string;
  title: string;
  description: string;
  type: string;
  basePath: string;
  indexPath: string;
  tags: string[];
}

export interface PrivateResourceCatalog {
  schemaVersion: 1;
  updatedAt: string | null;
  collections: PrivateResourceCollection[];
}

const collectionIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const privatePathPattern = /^\/private\/(?:[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/)*[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PRIVATE_RESOURCE_CATALOG_CACHE_TTL_MS = 3 * 60 * 1000;

type PrivateResourceCatalogCacheEntry = {
  catalog: PrivateResourceCatalog;
  expiresAt: number;
};

const privateResourceCatalogCache = new Map<string, PrivateResourceCatalogCacheEntry>();

export const fallbackPrivateResourceCatalog: PrivateResourceCatalog = {
  schemaVersion: 1,
  updatedAt: null,
  collections: [
    {
      collectionId: "6minuteenglish",
      title: "6 Minute English",
      description: "BBC Learning English 精听、跟读与复述课程",
      type: "audio-transcript",
      basePath: "/private/english-learning/6minuteenglish",
      indexPath: "/private/english-learning/6minuteenglish/index.json",
      tags: ["英语学习", "精听", "B1-B2"],
    },
  ],
};

export class PrivateResourceDataError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PrivateResourceDataError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function catalogCacheKey(session: PrivateAuthSession): string {
  return session.user.id;
}

export function invalidatePrivateResourceCatalogCache(userId?: string): void {
  if (userId) {
    privateResourceCatalogCache.delete(userId);
    return;
  }
  privateResourceCatalogCache.clear();
}

export function isPrivateResourcePath(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 768 &&
    privatePathPattern.test(value) &&
    !value.includes("..") &&
    !value.includes("//");
}

function isCollection(value: unknown): value is PrivateResourceCollection {
  if (!isRecord(value)) return false;
  return typeof value.collectionId === "string" &&
    collectionIdPattern.test(value.collectionId) &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    value.title.length <= 200 &&
    typeof value.description === "string" &&
    value.description.length <= 1000 &&
    typeof value.type === "string" &&
    collectionIdPattern.test(value.type) &&
    isPrivateResourcePath(value.basePath) &&
    isPrivateResourcePath(value.indexPath) &&
    value.indexPath.startsWith(`${value.basePath}/`) &&
    Array.isArray(value.tags) &&
    value.tags.length <= 20 &&
    value.tags.every((tag) => typeof tag === "string" && tag.length <= 50);
}

export function privateResourceItemPath(
  collection: PrivateResourceCollection,
  itemId: string,
  filename: string,
): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(itemId) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(filename)
  ) {
    throw new Error("私人资源路径参数无效");
  }
  return `${collection.basePath}/${itemId}/${filename}`;
}

export async function fetchPrivateResourceCatalog(
  url: string,
  signal?: AbortSignal,
): Promise<PrivateResourceCatalog> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) {
    throw new PrivateResourceDataError(response.status, `私人资源目录读取失败（${response.status}）`);
  }
  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    payload.schemaVersion !== 1 ||
    !Array.isArray(payload.collections) ||
    !payload.collections.every(isCollection)
  ) {
    throw new Error("私人资源目录格式不正确");
  }
  const ids = payload.collections.map((collection) => collection.collectionId);
  if (new Set(ids).size !== ids.length) throw new Error("私人资源目录包含重复合集");
  return payload as unknown as PrivateResourceCatalog;
}

export async function loadPrivateResourceCatalog(
  session: PrivateAuthSession,
  signal?: AbortSignal,
  options: { force?: boolean } = {},
): Promise<PrivateResourceCatalog> {
  const cacheKey = catalogCacheKey(session);
  const cached = privateResourceCatalogCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return cached.catalog;
  }
  if (cached) privateResourceCatalogCache.delete(cacheKey);

  let catalog: PrivateResourceCatalog;
  try {
    const signed = await signPrivateResourceCatalog(session, signal);
    const catalogUrl = signed.resources.catalog;
    if (!catalogUrl) throw new Error("认证服务未返回私人资源目录地址");
    catalog = await fetchPrivateResourceCatalog(catalogUrl, signal);
  } catch (error) {
    if (
      (error instanceof PrivateResourceDataError && error.status === 404) ||
      usesLegacyPrivateAuth(error)
    ) {
      catalog = fallbackPrivateResourceCatalog;
    } else {
      throw error;
    }
  }

  privateResourceCatalogCache.set(cacheKey, {
    catalog,
    expiresAt: Date.now() + PRIVATE_RESOURCE_CATALOG_CACHE_TTL_MS,
  });
  return catalog;
}

export function usesLegacyPrivateAuth(error: unknown): boolean {
  return error instanceof PrivateAuthApiError &&
    ["INVALID_EPISODE_ID", "INVALID_RESOURCE_REQUEST"].includes(error.code);
}
