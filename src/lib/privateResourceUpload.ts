import type { PrivateResourceUploadTarget } from "@/lib/privateAuth";
import { logPrivatePerformance } from "@/lib/privatePerformance";

export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface UploadOptions {
  retries?: number;
  signal?: AbortSignal;
}

const DEFAULT_RETRIES = 2;

function retryDelay(attempt: number): number {
  return 350 * attempt + Math.floor(Math.random() * 250);
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("上传已取消", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("上传已取消", "AbortError"));
    }, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function uploadAttempt(
  file: File,
  target: PrivateResourceUploadTarget,
  onProgress: (progress: UploadProgress) => void,
  signal: AbortSignal | undefined,
  attempt: number,
  highestLoaded: { value: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("上传已取消", "AbortError"));
      return;
    }

    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    request.open("PUT", target.uploadUrl);
    Object.entries(target.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    signal?.addEventListener("abort", abort, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", abort);
    request.upload.addEventListener("progress", (event) => {
      highestLoaded.value = Math.max(highestLoaded.value, event.loaded);
      onProgress({
        loaded: highestLoaded.value,
        total: event.lengthComputable ? event.total : file.size,
      });
    });
    request.addEventListener("load", () => {
      cleanup();
      if (request.status >= 200 && request.status < 300) {
        highestLoaded.value = file.size;
        onProgress({ loaded: file.size, total: file.size });
        resolve();
        return;
      }
      // A retry may receive 409 because the previous PUT actually reached OSS but
      // the client lost the response. The FC completion step verifies size/type
      // and media magic before publishing, so treating this retry as uploaded is safe.
      if (attempt > 0 && request.status === 409) {
        highestLoaded.value = file.size;
        onProgress({ loaded: file.size, total: file.size });
        resolve();
        return;
      }
      const error = new Error(`OSS 上传失败（${request.status}）`);
      Object.assign(error, { status: request.status });
      reject(error);
    });
    request.addEventListener("error", () => {
      cleanup();
      const error = new Error("无法连接 OSS，请检查网络或跨域配置");
      Object.assign(error, { status: 0 });
      reject(error);
    });
    request.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("上传已取消", "AbortError"));
    });
    request.send(file);
  });
}

export async function uploadPrivateResourceFile(
  file: File,
  target: PrivateResourceUploadTarget,
  onProgress: (progress: UploadProgress) => void,
  options: UploadOptions = {},
): Promise<void> {
  const retries = Math.max(0, Math.min(options.retries ?? DEFAULT_RETRIES, 4));
  const startedAt = performance.now();
  const highestLoaded = { value: 0 };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await uploadAttempt(file, target, onProgress, options.signal, attempt, highestLoaded);
      logPrivatePerformance("OSS upload", performance.now() - startedAt, {
        bytes: file.size,
        attempts: attempt + 1,
      });
      return;
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
      const status = Number((error as { status?: number }).status ?? 0);
      const retryable = status === 0 || isRetryableStatus(status);
      if (!retryable || attempt >= retries) {
        logPrivatePerformance("OSS upload failed", performance.now() - startedAt, {
          bytes: file.size,
          attempts: attempt + 1,
          status,
        });
        throw error;
      }
      await wait(retryDelay(attempt + 1), options.signal);
    }
  }
}
