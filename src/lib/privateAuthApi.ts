export const PRIVATE_AUTH_API_BASE = "https://www.yanxiao.me/api/private-auth";

interface AssistantStreamPayload {
  code?: string;
  content?: string;
  message?: string;
  model?: string;
  status?: number;
}

type ErrorFactory = (status: number, code: string, message: string) => Error;

function parsePayload(value: string): AssistantStreamPayload {
  try {
    return JSON.parse(value) as AssistantStreamPayload;
  } catch {
    return {};
  }
}

export async function readAssistantEventStream(
  response: Response,
  onDelta: (content: string) => void,
  createError: ErrorFactory,
): Promise<{ model: string }> {
  if (!response.ok) {
    const payload = parsePayload(await response.text());
    throw createError(
      response.status,
      payload.code ?? "REQUEST_FAILED",
      payload.message ?? "AI 问答暂时不可用",
    );
  }
  if (!response.body) {
    throw createError(response.status, "INVALID_RESPONSE", "AI 服务未返回响应流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let model = "";
  let completed = false;

  function dispatch(block: string): void {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/u)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    const payload = parsePayload(data.join("\n"));
    if (event === "meta" && typeof payload.model === "string") model = payload.model;
    else if (event === "delta" && typeof payload.content === "string") onDelta(payload.content);
    else if (event === "done") completed = true;
    else if (event === "error") {
      throw createError(
        payload.status ?? 500,
        payload.code ?? "STREAM_ERROR",
        payload.message ?? "AI 问答暂时不可用",
      );
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary = buffer.search(/\r?\n\r?\n/u);
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/u)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + separator.length);
        dispatch(block);
        boundary = buffer.search(/\r?\n\r?\n/u);
      }
      if (done) break;
    }
    if (buffer.trim()) dispatch(buffer);
    if (!completed) throw createError(response.status, "INCOMPLETE_STREAM", "AI 响应流意外中断");
    return { model };
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
  }
}
