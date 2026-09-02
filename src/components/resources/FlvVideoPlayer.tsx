import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

export default function FlvVideoPlayer({ src }: { src: string }): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let player: { destroy: () => void } | null = null;
    setError(null);
    setLoading(true);
    void import("mpegts.js").then((module) => {
      if (disposed || !videoRef.current) return;
      const mpegts = module.default;
      if (!mpegts.isSupported()) {
        setError("当前浏览器不支持 FLV 的 MSE 播放，请使用最新版 Chrome、Edge 或 Safari。");
        setLoading(false);
        return;
      }
      const instance = mpegts.createPlayer({ type: "flv", url: src, isLive: false });
      instance.attachMediaElement(videoRef.current);
      instance.on(mpegts.Events.ERROR, () => {
        if (!disposed) setError("FLV 无法播放，文件编码可能不受浏览器支持。");
      });
      instance.load();
      player = instance;
      setLoading(false);
    }).catch(() => {
      if (!disposed) {
        setError("FLV 播放器加载失败。");
        setLoading(false);
      }
    });
    return () => {
      disposed = true;
      player?.destroy();
    };
  }, [src]);

  return (
    <div className="space-y-3">
      {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" />正在加载 FLV 播放器…</p>}
      {error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{error}</p>}
      <video className="aspect-video w-full rounded-2xl bg-black" controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} playsInline ref={videoRef} />
    </div>
  );
}
