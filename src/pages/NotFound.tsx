import type { JSX } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "react-router-dom";

export default function NotFound(): JSX.Element {
  const location = useLocation();

  return (
    <>
      <Helmet>
        <title>404 · 彦骁的笔记</title>
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-6 py-20 sm:px-8">
          <div className="w-full">
            <p className="font-mono text-sm tracking-[0.18em] text-rose-300">
              404 / ROUTE_NOT_FOUND
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              这里没有对应的笔记
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-500">
              路径可能已经调整，或者内容仍在整理中。
            </p>
            <code className="mt-6 block max-w-full overflow-hidden text-ellipsis rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-xs text-slate-600">
              {location.pathname}
            </code>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 hover:bg-cyan-100"
                to="/"
              >
                <ArrowLeft className="size-4" />
                返回首页
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm text-slate-300 hover:border-white/30 hover:text-white"
                to="/notes"
              >
                <Search className="size-4" />
                搜索笔记
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
