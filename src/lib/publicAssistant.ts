import { PRIVATE_AUTH_API_BASE, readAssistantEventStream } from "@/lib/privateAuthApi";

const PUBLIC_ASSISTANT_ENDPOINT = `${PRIVATE_AUTH_API_BASE}/public/assistant/ask`;

export class PublicAssistantApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PublicAssistantApiError";
    this.status = status;
    this.code = code;
  }
}

export async function askPublicAssistant(
  body: { pagePath: string; question: string },
  onDelta: (content: string) => void,
  signal?: AbortSignal,
): Promise<{ model: string }> {
  const response = await fetch(PUBLIC_ASSISTANT_ENDPOINT, {
    method: "POST",
    headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    signal,
  });

  return readAssistantEventStream(
    response,
    onDelta,
    (status, code, message) => new PublicAssistantApiError(status, code, message),
  );
}
