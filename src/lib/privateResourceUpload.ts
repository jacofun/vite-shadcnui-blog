import type { PrivateResourceUploadTarget } from "@/lib/privateAuth";

export interface UploadProgress {
  loaded: number;
  total: number;
}

export function uploadPrivateResourceFile(
  file: File,
  target: PrivateResourceUploadTarget,
  onProgress: (progress: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.uploadUrl);
    Object.entries(target.headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.addEventListener("progress", (event) => {
      onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size });
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress({ loaded: file.size, total: file.size });
        resolve();
        return;
      }
      reject(new Error(`OSS 上传失败（${request.status}）`));
    });
    request.addEventListener("error", () => reject(new Error("无法连接 OSS，请检查网络或跨域配置")));
    request.addEventListener("abort", () => reject(new Error("上传已取消")));
    request.send(file);
  });
}
