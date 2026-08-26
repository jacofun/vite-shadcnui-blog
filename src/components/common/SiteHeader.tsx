import type { JSX } from "react";
import { BookOpen, Heart, Terminal } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navigation = [
  { label: "首页", to: "/" },
  { label: "笔记", to: "/notes" },
];

export default function SiteHeader(): JSX.Element {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link className="flex items-center gap-3" to="/">
          <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
            <Terminal className="size-4 text-cyan-300" />
          </span>
          <span className="text-sm font-semibold tracking-[0.16em] text-white">
            YANXIAO.ME
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-1 text-sm">
          {navigation.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);

            return (
              <Link
                className={`rounded-lg px-3 py-2 transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-500 hover:text-slate-200"
                }`}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            aria-label="婚礼纪念"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-300/10 hover:text-rose-200"
            to="/wedding"
          >
            <Heart className="size-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
