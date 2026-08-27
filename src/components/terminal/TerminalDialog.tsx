import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";

import XtermView from "./XtermView";

type TerminalDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type TerminalPanelStyle = CSSProperties & {
  "--terminal-panel-height": string;
  "--terminal-panel-top": string;
};

const initialTerminalPanelStyle: TerminalPanelStyle = {
  "--terminal-panel-height": "min(560px, calc(100dvh - 4rem))",
  "--terminal-panel-top": "4rem",
};

export default function TerminalDialog({
  onOpenChange,
  open,
}: TerminalDialogProps): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) return;

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      contentRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    const viewport = window.visualViewport;

    const syncViewport = () => {
      const content = contentRef.current;

      if (!content) return;

      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportBottom = viewportTop + viewportHeight;
      const headerBottom =
        document.querySelector<HTMLElement>("[data-site-header]")
          ?.getBoundingClientRect().bottom ?? 64;
      const panelTop = Math.max(viewportTop, headerBottom);
      const availableHeight = Math.max(0, viewportBottom - panelTop);
      const panelHeight = isMaximized
        ? availableHeight
        : Math.min(560, availableHeight);

      content.style.setProperty("--terminal-panel-top", `${panelTop}px`);
      content.style.setProperty(
        "--terminal-panel-height",
        `${panelHeight}px`,
      );
    };

    let delayedSyncId: number | undefined;
    const scheduleViewportSync = () => {
      syncViewport();
      window.requestAnimationFrame(syncViewport);
      window.clearTimeout(delayedSyncId);
      delayedSyncId = window.setTimeout(syncViewport, 320);
    };

    scheduleViewportSync();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("focusin", scheduleViewportSync);
    window.addEventListener("focusout", scheduleViewportSync);
    window.addEventListener("resize", syncViewport);

    return () => {
      window.clearTimeout(delayedSyncId);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("focusin", scheduleViewportSync);
      window.removeEventListener("focusout", scheduleViewportSync);
      window.removeEventListener("resize", syncViewport);
    };
  }, [isMaximized]);

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[90] bg-black/35 backdrop-blur-[2px] transition-opacity duration-200 ${
          open
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        }`}
        onPointerDown={close}
      />
      <div
        aria-describedby="terminal-dialog-description"
        aria-hidden={!open}
        aria-labelledby="terminal-dialog-title"
        aria-modal="true"
        className={`fixed left-1/2 top-[var(--terminal-panel-top)] z-[100] flex w-full max-w-6xl -translate-x-1/2 overflow-hidden rounded-b-2xl border-x border-b border-white/10 bg-[#070a12] shadow-[0_30px_100px_rgba(0,0,0,0.65)] outline-none transition-[opacity,transform] duration-200 ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible pointer-events-none -translate-y-4 opacity-0"
        }`}
        inert={!open}
        ref={contentRef}
        role="dialog"
        style={initialTerminalPanelStyle}
      >
        <div
          className="flex min-h-0 w-full flex-col"
          style={{ height: "var(--terminal-panel-height)" }}
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-white/[0.025] px-4">
            <div className="flex items-center gap-2">
              <button
                aria-label="关闭终端"
                className="group flex size-3.5 items-center justify-center rounded-full bg-rose-400/80 transition hover:bg-rose-300"
                onClick={close}
                type="button"
              >
                <X className="size-2.5 text-rose-950 opacity-0 transition group-hover:opacity-100" />
              </button>
              <button
                aria-label="收起终端"
                className="group flex size-3.5 items-center justify-center rounded-full bg-amber-300/80 transition hover:bg-amber-200"
                onClick={close}
                type="button"
              >
                <Minimize2 className="size-2.5 text-amber-950 opacity-0 transition group-hover:opacity-100" />
              </button>
              <button
                aria-label={
                  isMaximized ? "还原终端高度" : "最大化终端高度"
                }
                className="group flex size-3.5 items-center justify-center rounded-full bg-emerald-400/80 transition hover:bg-emerald-300"
                onClick={() => setIsMaximized((value) => !value)}
                type="button"
              >
                <Maximize2 className="size-2.5 text-emerald-950 opacity-0 transition group-hover:opacity-100" />
              </button>
            </div>

            <h2
              className="font-mono text-[10px] tracking-[0.14em] text-slate-500 sm:text-xs"
              id="terminal-dialog-title"
            >
              visitor@yanxiao.me — terminal
            </h2>
            <span className="w-[58px]" />
          </div>

          <p className="sr-only" id="terminal-dialog-description">
            输入命令浏览彦骁的笔记并探索隐藏内容。
          </p>
          <div className="min-h-0 flex-1">
            <XtermView />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
