import { ArrowUpRight } from "lucide-react";
import type { JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import FragmentMedia from "@/components/fragments/FragmentMedia";
import { fragments } from "@/content/fragments";

function displayDate(value: string): string {
  return value.replaceAll("-", ".");
}

export default function Fragments(): JSX.Element {
  return (
    <>
      <Helmet>
        <title>碎片 · 彦骁的笔记</title>
        <meta content="照片、截图、声音、短视频，以及一些没必要单独写成文章的东西。" name="description" />
        <link href="https://yanxiao.me/fragments/" rel="canonical" />
        <meta content="碎片 · 彦骁的笔记" property="og:title" />
        <meta content="照片、截图、声音、短视频，以及一些没必要单独写成文章的东西。" property="og:description" />
        <meta content="https://yanxiao.me/fragments/" property="og:url" />
        <meta content="website" property="og:type" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] px-6 pb-24 pt-14 text-slate-100 sm:px-8 sm:pt-20 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <header className="max-w-2xl border-b border-white/10 pb-10 sm:pb-14">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">FRAGMENTS</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">碎片</h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-400">
              一些没必要单独写成文章的东西。
            </p>
          </header>

          <section aria-label="碎片记录" className="mt-4">
            {fragments.map((fragment, index) => (
              <article
                className="grid gap-5 border-b border-white/[0.08] py-9 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-8 sm:py-12"
                key={fragment.id}
              >
                <div className="flex items-center justify-between sm:block">
                  <time className="font-mono text-[11px] tracking-[0.08em] text-slate-600">{displayDate(fragment.date)}</time>
                  <span className="font-mono text-[10px] tracking-[0.12em] text-slate-700 sm:mt-2 sm:block">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="min-w-0">
                  {fragment.text && (
                    <p className="max-w-2xl whitespace-pre-wrap text-[17px] leading-8 text-slate-300 sm:text-lg sm:leading-9">
                      {fragment.text}
                    </p>
                  )}
                  {fragment.media && (
                    <div className={fragment.text ? "mt-6" : ""}>
                      <FragmentMedia media={fragment.media} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>

          <div className="mt-12 flex justify-end">
            <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/notes">
              去看完整文章
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
