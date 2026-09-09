const PUBLIC_ASSISTANT_ENDPOINT = "/api/private-auth/public/assistant/ask";

interface ErrorBody {
  code?: string;
  message?: string;
}

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
  signal?: AbortSignal,
): Promise<{ answer: string; model: string }> {
  const response = await fetch(PUBLIC_ASSISTANT_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    signal,
  });

  let payload: { answer: string; model: string } | ErrorBody;
  try {
    payload = await response.json() as { answer: string; model: string } | ErrorBody;
  } catch {
    throw new PublicAssistantApiError(response.status, "INVALID_RESPONSE", "AI 服务返回了无法解析的响应");
  }

  if (!response.ok) {
    const error = payload as ErrorBody;
    throw new PublicAssistantApiError(
      response.status,
      error.code ?? "REQUEST_FAILED",
      error.message ?? "AI 问答暂时不可用",
    );
  }

  return payload as { answer: string; model: string };
}
