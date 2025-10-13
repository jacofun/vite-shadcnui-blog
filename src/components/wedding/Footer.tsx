import type { JSX } from "react";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import { Separator } from "@/components/ui/separator";

const NAV_LINKS = [
  { to: "/articles", label: "文章" },
  { to: "/about", label: "关于我" },
];

export default function Footer(): JSX.Element {
  return (
    <footer className="bg-[#1d1d1f] text-white">
      <div className="mx-auto w-full max-w-5xl px-8 py-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-lg sm:text-3xl font-semibold">彦骁的笔记</p>
            <Separator className="bg-white/10" />
          </div>



          <nav className="flex flex-row items-center text-sm sm:text-lg font-medium">
            {NAV_LINKS.map((link, idx) => (
              <Fragment key={link.to}>
                {idx > 0 && (
                  <Separator
                    orientation="vertical"
                    className="mx-4 h-4 shrink-0 bg-white/30" // 间距＋高度，避免被压缩
                  />
                )}
                <Link
                  to={link.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-white/80"
                >
                  {link.label}
                </Link>
              </Fragment>
            ))}
          </nav>



          {/* 备案、版权区域 */}
          <div className="flex flex-col w-full items-center space-y-1 text-xs sm:text-sm text-white/60">
            <p >© 2025 yanxiao.me </p>
            <a
              className="transition hover:text-white/80 "
              href="https://beian.miit.gov.cn"
              rel="noopener noreferrer"
              target="_blank"
            >
              宁ICP备2025009266号-1
            </a>
            <a
              className="transition hover:text-white/80 flex"
              href="https://beian.mps.gov.cn/#/query/webSearch?code=64010602001156"
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                src="/images/beian.png"
                alt="beian"
                className="size-4" />
              宁公网安备64010602001156号
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
