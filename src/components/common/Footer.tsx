import type { JSX } from "react";
import { Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

export default function Footer(): JSX.Element {
  return (
    <footer className="border-t border-white/10 bg-[#05070d] text-slate-400">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="border-b border-white/10 pb-8">
          <Link
            className="inline-flex items-center gap-3 text-white"
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
        </div>

        <div className="flex flex-col justify-between gap-4 pt-6 text-xs text-slate-600 sm:flex-row sm:items-end">
          <p>© 2025-2026 yanxiao.me 彦骁的笔记</p>
          <div className="flex flex-col gap-2 sm:items-end">
            <p>
              免责声明：本站部分内容由 AI 生成或辅助整理，信息可能有误，请注意甄别。
            </p>
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
      </div>
    </footer>
  );
}
