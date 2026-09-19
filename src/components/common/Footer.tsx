import type { JSX } from "react";
import { Link } from "react-router-dom";

const scrollToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

export default function Footer(): JSX.Element {
  return (
    <footer className="border-t border-white/10 bg-[#05070d] text-slate-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6 text-xs text-slate-600 sm:px-8 md:flex-row md:items-end md:justify-between lg:px-10">
        <div>
          <Link className="text-xs font-semibold tracking-[0.14em] text-slate-300 transition hover:text-white" onClick={scrollToTop} to="/">
            YANXIAO.ME
          </Link>
          <p className="mt-2">© 2025-2026 彦骁的笔记</p>
        </div>

        <div className="flex max-w-2xl flex-col gap-2 md:items-end">
          <p className="leading-5">本站部分内容由 AI 生成或辅助整理，信息可能有误，请注意甄别。</p>
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
              <img alt="公安备案" className="size-3.5 opacity-70" src="/images/beian.png" />
              宁公网安备64010602001156号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
