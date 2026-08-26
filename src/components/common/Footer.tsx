import type { JSX } from "react";
import { Heart, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { href: "/#notes", label: "笔记" },
  { href: "/#about", label: "关于" },
];

export default function Footer(): JSX.Element {
  return (
    <footer className="border-t border-white/10 bg-[#05070d] text-slate-400">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
          <Link className="flex items-center gap-3 text-white" to="/">
            <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
              <Terminal className="size-4 text-cyan-300" />
            </span>
            <span className="text-sm font-semibold tracking-[0.14em]">
              彦骁的笔记
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <a
                className="transition hover:text-white"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </a>
            ))}
            <Link
              className="inline-flex items-center gap-1.5 transition hover:text-rose-200"
              to="/wedding"
            >
              <Heart className="size-3.5" />
              婚礼纪念
            </Link>
          </nav>
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
