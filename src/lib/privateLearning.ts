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
  sha256?: string;
  etag?: string;
}

export interface PrivateLearningTargetExpression {
  expression: string;
  meaning: string;
  usage: string;
}

export interface PrivateLearningChoiceQuestion {
  id: string;
  type: "single-choice";
  prompt: string;
  targetExpression: string;
  options: Array<{ id: string; text: string }>;
  answer: string;
  explanation: string;
}

export interface PrivateLearningFillQuestion {
  id: string;
  type: "fill-blank";
  prompt: string;
  targetExpression: string;
  answers: string[];
  explanation: string;
}

export type PrivateLearningObjectiveQuestion =
  | PrivateLearningChoiceQuestion
  | PrivateLearningFillQuestion;

export interface PrivateLearningAssessment {
  schemaVersion: 1;
  targetExpressions: PrivateLearningTargetExpression[];
  objectiveQuestions: PrivateLearningObjectiveQuestion[];
  retellingPrompt: string;
  referencePoints: string[];
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
    transcriptPdf?: ResourceMetadata;
    transcriptText: ResourceMetadata;
  };
  assessment?: PrivateLearningAssessment | null;
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

function isAssessment(value: unknown): value is PrivateLearningAssessment {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      !Array.isArray(value.targetExpressions) || value.targetExpressions.length > 12 ||
      !Array.isArray(value.objectiveQuestions) || value.objectiveQuestions.length > 20 ||
      typeof value.retellingPrompt !== "string" ||
      !Array.isArray(value.referencePoints) || !value.referencePoints.every((point) => typeof point === "string")) {
    return false;
  }
  const targetsValid = value.targetExpressions.every((item) =>
    isRecord(item) && ["expression", "meaning", "usage"].every((key) => typeof item[key] === "string"));
  const questionsValid = value.objectiveQuestions.every((question) => {
    if (!isRecord(question) || typeof question.id !== "string" || typeof question.prompt !== "string" ||
        typeof question.targetExpression !== "string" || typeof question.explanation !== "string") return false;
    if (question.type === "single-choice") {
      return typeof question.answer === "string" && Array.isArray(question.options) &&
        question.options.length >= 2 && question.options.every((option) =>
          isRecord(option) && typeof option.id === "string" && typeof option.text === "string");
    }
    return question.type === "fill-blank" && Array.isArray(question.answers) &&
      question.answers.length > 0 && question.answers.every((answer) => typeof answer === "string");
  });
  return targetsValid && questionsValid;
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
  if (!isRecord(payload) || payload.schemaVersion !== 1 || !isEpisodeCore(payload) ||
      (payload.assessment !== undefined && payload.assessment !== null && !isAssessment(payload.assessment))) {
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
