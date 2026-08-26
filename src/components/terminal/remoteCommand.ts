import type { CommandResult } from "./types";

type RemoteCommandResponse = {
  output?: unknown;
};

export async function executeRemoteCommand(
  command: string,
  args: string[],
): Promise<CommandResult> {
  const apiBaseUrl = import.meta.env.VITE_TERMINAL_API_URL?.trim();

  if (!apiBaseUrl) {
    return {
      output: [
        "REMOTE CHANNEL: OFFLINE",
        "云函数命令通道尚未配置。",
      ],
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/terminal/execute`,
      {
        body: JSON.stringify({ args, command }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = (await response.json()) as RemoteCommandResponse;
    const output = Array.isArray(payload.output)
      ? payload.output.filter(
          (line): line is string => typeof line === "string",
        )
      : [];

    return {
      output: output.length ? output : ["远程命令没有返回内容。"],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { output: [`REMOTE ERROR: ${message}`] };
  } finally {
    window.clearTimeout(timeout);
  }
}
