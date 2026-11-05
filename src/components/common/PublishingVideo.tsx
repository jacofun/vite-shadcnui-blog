import { useState } from "react";

export default function PublishingVideo({
  src,
  name,
  className = "w-full",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  return (
    <div className="min-w-0">
      <video
        className={className}
        src={src}
        aria-label={name}
        controls
        playsInline
        preload="none"
        onError={() => setFailedSource(src)}
      />
      {failedSource === src && (
        <p role="status" className="mt-2 text-xs leading-6 text-slate-400">
          当前浏览器无法播放或视频暂时不可用，可打开原文件后使用本地播放器观看。
        </p>
      )}
      <a
        className="mt-2 inline-block max-w-full break-words text-xs leading-6 text-cyan-200 underline underline-offset-4"
        href={src}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
      >
        打开或下载原视频：{name}
      </a>
    </div>
  );
}
