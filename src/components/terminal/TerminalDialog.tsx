import { useCallback, useState, type JSX } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Maximize2, Minimize2, X } from "lucide-react";

import XtermView from "./XtermView";

type TerminalDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export default function TerminalDialog({
  onOpenChange,
  open,
}: TerminalDialogProps): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          className={`fixed z-[100] flex overflow-hidden border border-white/10 bg-[#070a12] shadow-[0_30px_100px_rgba(0,0,0,0.65)] outline-none transition-all duration-300 ${
            isMaximized
              ? "inset-0 h-dvh w-screen rounded-none"
              : "inset-x-3 top-1/2 h-[min(680px,calc(100dvh-1.5rem))] -translate-y-1/2 rounded-2xl sm:left-1/2 sm:w-[min(900px,calc(100vw-3rem))] sm:-translate-x-1/2"
          }`}
        >
          <div className="flex min-h-0 w-full flex-col">
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
                  aria-label="最小化终端"
                  className="group flex size-3.5 items-center justify-center rounded-full bg-amber-300/80 transition hover:bg-amber-200"
                  onClick={close}
                  type="button"
                >
                  <Minimize2 className="size-2.5 text-amber-950 opacity-0 transition group-hover:opacity-100" />
                </button>
                <button
                  aria-label={isMaximized ? "还原终端" : "最大化终端"}
                  className="group flex size-3.5 items-center justify-center rounded-full bg-emerald-400/80 transition hover:bg-emerald-300"
                  onClick={() => setIsMaximized((value) => !value)}
                  type="button"
                >
                  <Maximize2 className="size-2.5 text-emerald-950 opacity-0 transition group-hover:opacity-100" />
                </button>
              </div>

              <DialogPrimitive.Title className="font-mono text-[10px] tracking-[0.14em] text-slate-500 sm:text-xs">
                visitor@yanxiao.me — terminal
              </DialogPrimitive.Title>
              <span className="w-[58px]" />
            </div>

            <DialogPrimitive.Description className="sr-only">
              输入命令浏览彦骁的笔记并探索隐藏内容。
            </DialogPrimitive.Description>
            <div className="min-h-0 flex-1">
              <XtermView onRequestClose={close} />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
