import type { JSX } from "react";
import { Fragment } from "react";

import { Separator } from "@/components/ui/separator";

const NAV_LINKS = [
  { href: "https://yanxiao.me/articles", label: "文章" },
  { href: "https://yanxiao.me/about", label: "关于" },
];

export default function Footer(): JSX.Element {
  return (
    <footer className="bg-[#1d1d1f] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-lg font-semibold">彦骁的笔记</p>
            <Separator className="bg-white/10" />
          </div>



          <nav className="flex items-center text-sm font-medium">
            {NAV_LINKS.map((link, idx) => (
              <Fragment key={link.href}>
                {idx > 0 && (
                  <Separator
                    orientation="vertical"
                    className="mx-4 h-4 shrink-0 bg-white/30" // 间距＋高度，避免被压缩
                  />
                )}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-white/80"
                >
                  {link.label}
                </a>
              </Fragment>
            ))}
          </nav>



          <div className="space-y-1 text-xs text-white/60">
            <p>© 2025 yanxiao.me 版权所有</p>
            <a
              className="transition hover:text-white/80"
              href="https://beian.miit.gov.cn"
              rel="noopener noreferrer"
              target="_blank"
            >
              宁ICP备2025009266号-1
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
