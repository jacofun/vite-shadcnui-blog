import type { JSX } from "react";
import { Heart, Sparkles, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

export default function Footer(): JSX.Element {
  return (
    <footer className="border-t border-white/10 bg-[#05070d] text-slate-400">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <Link
            className="flex items-center gap-3 text-white"
            onClick={scrollToTop}
            to="/"
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
              <Terminal className="size-4 text-cyan-300" />
            </span>
            <span className="text-sm font-semibold tracking-[0.14em]">
              YANXIAO.ME
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <Link
              className="transition hover:text-white"
              onClick={scrollToTop}
              to="/"
            >
              首页
            </Link>
            <Link
              className="transition hover:text-white"
              onClick={scrollToTop}
              to="/notes"
            >
              笔记
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 transition hover:text-rose-200"
              onClick={scrollToTop}
              to="/wedding"
            >
              <Heart className="size-3.5" />
              婚礼纪念
            </Link>
          </nav>
        </div>

        <div className="border-b border-white/10 py-5">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-gradient-to-r from-cyan-300/[0.06] via-white/[0.025] to-violet-300/[0.06] px-4 py-4">
            <div className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-violet-400/10 blur-3xl" />
            <div className="relative flex items-start gap-3 sm:items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08]">
                <Sparkles className="size-4 text-cyan-300/80" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] text-cyan-300/65">
                    AI CONTENT NOTICE
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    本站部分内容由 AI 生成或辅助整理，信息可能有误，请注意甄别。
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 font-mono text-[9px] tracking-[0.14em] text-violet-200/55">
                  AI ASSISTED
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 pt-6 text-xs text-slate-600 sm:flex-row sm:items-center">
          <p>© 2026 yanxiao.me</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <a
              className="transition hover:text-slate-300"
              href="https://beian.miit.gov.cn"
              rel="noopener noreferrer"
              target="_blank"
            >
              宁ICP备2025009266号-1
            </a>
            <a
              className="inline-flex items-center gap-1.5 transition hover:text-slate-300"
              href="https://beian.mps.gov.cn/#/query/webSearch?code=64010602001156"
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt="公安备案"
                className="size-3.5 opacity-70"
                src="/images/beian.png"
              />
              宁公网安备64010602001156号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
