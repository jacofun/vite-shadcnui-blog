import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type JSX,
} from "react";
import { BookOpen, Heart, House, Terminal, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { terminalOpenEvent } from "@/lib/terminal";

const TerminalDialog = lazy(
  () => import("@/components/terminal/TerminalDialog"),
);

const navigation = [
  { icon: House, label: "首页", to: "/" },
  { icon: BookOpen, label: "笔记", to: "/notes" },
  { icon: UserRound, label: "私人学习", to: "/learning/english" },
  { icon: Heart, label: "婚礼纪念", to: "/wedding" },
];

const terminalOpenStorageKey = "yanxiao-terminal-open";

function readStoredTerminalOpen(): boolean {
  try {
    return window.sessionStorage.getItem(terminalOpenStorageKey) === "true";
  } catch {
    return false;
  }
}

export default function SiteHeader(): JSX.Element {
  const location = useLocation();
  const [isTerminalOpen, setIsTerminalOpen] = useState(
    readStoredTerminalOpen,
  );
  const [hasTerminalMounted, setHasTerminalMounted] = useState(
    isTerminalOpen,
  );

  const updateTerminalOpen = useCallback((open: boolean) => {
    if (open) {
      setHasTerminalMounted(true);
    }

    setIsTerminalOpen(open);

    try {
      window.sessionStorage.setItem(terminalOpenStorageKey, String(open));
    } catch {
      // The terminal remains usable when session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "Backquote") {
        event.preventDefault();
        setIsTerminalOpen((value) => {
          const nextValue = !value;

          try {
            window.sessionStorage.setItem(
              terminalOpenStorageKey,
              String(nextValue),
            );
          } catch {
            // The shortcut remains usable when session storage is unavailable.
          }

          return nextValue;
        });
      }
    };

    const handleTerminalOpen = () => updateTerminalOpen(true);

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener(terminalOpenEvent, handleTerminalOpen);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener(terminalOpenEvent, handleTerminalOpen);
    };
  }, [updateTerminalOpen]);

  return (
    <>
      <header
        className="relative border-b border-white/10 bg-[#070a12]/95 lg:bg-[#070a12]/85 lg:backdrop-blur-xl"
        data-site-header
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              aria-haspopup="dialog"
              aria-expanded={isTerminalOpen}
              aria-label={isTerminalOpen ? "收起终端" : "打开终端"}
              className="group flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
              onClick={() => updateTerminalOpen(!isTerminalOpen)}
              title={`${isTerminalOpen ? "收起" : "打开"}终端（Ctrl + \`）`}
              type="button"
            >
              <Terminal className="size-4 text-cyan-300 transition group-hover:scale-110" />
            </button>
            <Link
              className="text-sm font-semibold tracking-[0.16em] text-white transition hover:text-cyan-100"
              to="/"
            >
              <span className="hidden min-[360px]:inline">YANXIAO.ME</span>
              <span className="min-[360px]:hidden">YX</span>
            </Link>
          </div>

          <nav
            aria-label="主导航"
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1"
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              const isWedding = item.to === "/wedding";

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  className={`flex size-8 items-center justify-center rounded-lg transition ${
                    isActive
                      ? isWedding
                        ? "bg-rose-300/15 text-rose-200"
                        : "bg-white/10 text-white"
                      : isWedding
                        ? "text-slate-500 hover:bg-rose-300/10 hover:text-rose-200"
                        : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
                  }`}
                  key={item.to}
                  title={item.label}
                  to={item.to}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {hasTerminalMounted && (
        <Suspense fallback={null}>
          <TerminalDialog
            onOpenChange={updateTerminalOpen}
            open={isTerminalOpen}
          />
        </Suspense>
      )}
    </>
  );
}
