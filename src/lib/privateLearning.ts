interface PrivateLearningEpisodeCore {
  episodeId: string;
  title: string;
  publishedAt: string;
  recommendedDate: string;
  reason: string;
  difficulty: string;
  tags: string[];
}

export interface PrivateLearningEpisodeSummary extends PrivateLearningEpisodeCore {
  metadataPath: string;
}

export interface PrivateLearningIndex {
  schemaVersion: 1;
  updatedAt: string | null;
  episodes: PrivateLearningEpisodeSummary[];
}

interface ResourceMetadata {
  path: string;
  contentType: string;
  bytes: number;
  sha256: string;
}

export interface PrivateLearningEpisode extends PrivateLearningEpisodeCore {
  schemaVersion: 1;
  sourcePage: string;
  audioSource: string;
  transcriptSource: string;
  syncedAt: string;
  objectPrefix: string;
  resources: {
    audio: ResourceMetadata;
    transcriptPdf: ResourceMetadata;
    transcriptText: ResourceMetadata;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEpisodeCore(value: unknown): value is PrivateLearningEpisodeCore {
  if (!isRecord(value)) return false;
  return [
    "episodeId",
    "title",
    "publishedAt",
    "recommendedDate",
    "reason",
    "difficulty",
  ].every((key) => typeof value[key] === "string") &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string");
}

function isEpisodeSummary(value: unknown): value is PrivateLearningEpisodeSummary {
  return isEpisodeCore(value) &&
    isRecord(value) &&
    typeof value.metadataPath === "string";
}

export async function fetchPrivateLearningIndex(
  url: string,
  signal?: AbortSignal,
): Promise<PrivateLearningIndex> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`课程索引读取失败（${response.status}）`);
  const payload: unknown = await response.json();
  if (
    !isRecord(payload) ||
    payload.schemaVersion !== 1 ||
    !Array.isArray(payload.episodes) ||
    !payload.episodes.every(isEpisodeSummary)
  ) {
    throw new Error("课程索引格式不正确");
  }
  return payload as unknown as PrivateLearningIndex;
}

export async function fetchPrivateLearningEpisode(
  url: string,
  signal?: AbortSignal,
): Promise<PrivateLearningEpisode> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`课程信息读取失败（${response.status}）`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.schemaVersion !== 1 || !isEpisodeCore(payload)) {
    throw new Error("课程信息格式不正确");
  }
  return payload as unknown as PrivateLearningEpisode;
}

export async function fetchPrivateLearningTranscript(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Transcript 读取失败（${response.status}）`);
  const transcript = (await response.text()).replace(/\r\n?/g, "\n").trim();
  if (transcript.length < 100) throw new Error("Transcript 内容不完整");
  return transcript;
}
