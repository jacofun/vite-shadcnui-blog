import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { X } from "lucide-react";
import { useState, type CSSProperties, type JSX } from "react";

import type { FragmentMedia as FragmentMediaData } from "@/content/fragments";

interface Props {
  media: FragmentMediaData;
}

const controllerStyles = {
  "--media-background-color": "transparent",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "rgba(255, 255, 255, 0.08)",
  "--media-primary-color": "rgb(226 232 240)",
  "--media-secondary-color": "rgb(8 12 21)",
  "--media-time-range-buffered-color": "rgba(148, 163, 184, 0.28)",
  "--media-range-track-background": "rgba(148, 163, 184, 0.22)",
  "--media-range-bar-color": "rgb(103 232 249)",
} as CSSProperties;

export default function FragmentMedia({ media }: Props): JSX.Element {
  const [imageOpen, setImageOpen] = useState(false);

  if (media.kind === "image") {
    return (
      <>
        <button
          aria-label={`查看图片：${media.alt}`}
          className="group block w-full overflow-hidden rounded-2xl bg-black/30 text-left"
          onClick={() => setImageOpen(true)}
          type="button"
        >
          <img
            alt={media.alt}
            className="max-h-[72svh] w-full object-cover transition duration-500 group-hover:scale-[1.01]"
            loading="lazy"
            src={media.src}
          />
        </button>
        {media.caption && <p className="mt-3 text-xs leading-6 text-slate-500">{media.caption}</p>}
        {imageOpen && (
          <div
            aria-label="图片预览"
            aria-modal="true"
            className="fixed inset-0 z-[220] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setImageOpen(false)}
            role="dialog"
          >
            <button
              aria-label="关闭图片预览"
              className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/10 text-slate-200"
              onClick={() => setImageOpen(false)}
              type="button"
            >
              <X className="size-5" />
            </button>
            <img
              alt={media.alt}
              className="max-h-[90svh] max-w-[94vw] object-contain"
              onClick={(event) => event.stopPropagation()}
              src={media.src}
            />
          </div>
        )}
      </>
    );
  }

  if (media.kind === "audio") {
    return (
      <div>
        <MediaController audio className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]" style={controllerStyles}>
          <audio preload="metadata" slot="media" src={media.src} />
          <MediaControlBar className="flex min-h-14 items-center px-2">
            <MediaPlayButton aria-label="播放或暂停" />
            <MediaTimeDisplay />
            <MediaTimeRange />
            <MediaTimeDisplay showDuration />
            <MediaMuteButton aria-label="静音" />
            <MediaVolumeRange className="hidden w-24 sm:inline-flex" />
          </MediaControlBar>
        </MediaController>
        {media.caption && <p className="mt-3 text-xs leading-6 text-slate-500">{media.caption}</p>}
      </div>
    );
  }

  return (
    <div>
      <MediaController className="relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black" style={controllerStyles}>
        <video
          className="h-full w-full object-contain"
          playsInline
          preload="metadata"
          slot="media"
          poster={media.poster}
          src={media.src}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
        <MediaControlBar className="absolute inset-x-0 bottom-0 z-10 flex min-h-12 items-center px-2">
          <MediaPlayButton aria-label="播放或暂停" />
          <MediaTimeDisplay className="hidden sm:inline-flex" />
          <MediaTimeRange />
          <MediaMuteButton aria-label="静音" />
          <MediaFullscreenButton aria-label="全屏" />
        </MediaControlBar>
      </MediaController>
      {media.caption && <p className="mt-3 text-xs leading-6 text-slate-500">{media.caption}</p>}
    </div>
  );
}
