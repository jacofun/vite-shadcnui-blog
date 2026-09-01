import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import type { CSSProperties, JSX } from "react";

interface Props {
  audioUrl: string;
  title: string;
}

const mediaStyles = {
  "--media-background-color": "transparent",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "rgba(255, 255, 255, 0.08)",
  "--media-primary-color": "rgb(226 232 240)",
  "--media-secondary-color": "rgb(8 12 21)",
  "--media-time-range-buffered-color": "rgba(148, 163, 184, 0.28)",
  "--media-range-track-background": "rgba(148, 163, 184, 0.22)",
  "--media-range-bar-color": "rgb(103 232 249)",
} as CSSProperties;

const playButtonStyles = {
  "--media-control-height": "32px",
  "--media-button-icon-width": "32px",
  "--media-button-icon-height": "32px",
} as CSSProperties;

export default function FixedAudioPlayer({ audioUrl, title }: Props): JSX.Element {
  return (
    <aside
      aria-label="资源音频播放器"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#080c15]/95 shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-8 lg:px-10">
        <p className="truncate px-2 pb-1 text-xs font-medium text-slate-400">{title}</p>
        <MediaController audio className="block w-full overflow-hidden rounded-xl bg-white/[0.035]" style={mediaStyles}>
          <audio key={audioUrl} preload="metadata" slot="media" src={audioUrl} />
          <MediaControlBar className="flex w-full items-center px-1">
            <MediaTimeDisplay showDuration />
            <MediaTimeRange />
          </MediaControlBar>
          <div className="relative min-h-14 px-1 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="absolute left-0 top-1/2 flex min-w-0 -translate-y-1/2 justify-start sm:static sm:translate-y-0">
              <MediaPlaybackRateButton aria-label="调整播放速度" />
            </div>
            <div className="contents sm:flex sm:items-center sm:justify-center sm:gap-2">
              <MediaSeekBackwardButton
                aria-label="后退 10 秒"
                className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                seekOffset={10}
              />
              <MediaPlayButton
                aria-label="播放或暂停"
                className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20 sm:static sm:translate-x-0 sm:translate-y-0"
                style={playButtonStyles}
              />
              <MediaSeekForwardButton
                aria-label="前进 10 秒"
                className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                seekOffset={10}
              />
            </div>
            <div className="absolute right-0 top-1/2 flex min-w-0 -translate-y-1/2 items-center justify-end sm:static sm:translate-y-0">
              <MediaMuteButton aria-label="静音" />
              <MediaVolumeRange className="hidden sm:inline-flex" />
            </div>
          </div>
        </MediaController>
      </div>
    </aside>
  );
}
