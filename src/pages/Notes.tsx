import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";

import AiDisclaimer from "@/components/common/AiDisclaimer";
import SiteHeader from "@/components/common/SiteHeader";
import {
  formatNoteDate,
  noteCategories,
  notes,
} from "@/lib/notes";

export default function Notes(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedCategory = searchParams.get("category") ?? "全部";

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape") {
        setQuery("");
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesCategory =
        selectedCategory === "全部" ||
        note.category === selectedCategory;
      const matchesQuery =
        !normalizedQuery ||
        [
          note.title,
          note.summary,
          note.category,
          ...note.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  const selectCategory = (category: string) => {
    if (category === "全部") {
      setSearchParams({});
      return;
    }

    setSearchParams({ category });
  };

  return (
    <>
      <Helmet>
        <title>全部笔记 · 彦骁的笔记</title>
        <meta content="浏览和搜索彦骁的技术、市场与学习笔记。" name="description" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <SiteHeader />
        <AiDisclaimer />
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">
              NOTES / INDEX
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              全部笔记
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              按分类浏览，或者直接搜索标题、摘要与标签。
            </p>
          </div>

          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
              <input
                aria-label="搜索笔记"
                className="h-12 w-full rounded-xl border border-white/10 bg-[#090d17] pl-11 pr-20 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、摘要或标签"
                ref={searchRef}
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="清除搜索"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-600 hover:text-white"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-600">
                  /
                </kbd>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["全部", ...noteCategories].map((category) => (
                <button
                  className={`rounded-lg px-3 py-2 text-xs transition ${
                    selectedCategory === category
                      ? "bg-white text-slate-950"
                      : "border border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-200"
                  }`}
                  key={category}
                  onClick={() => selectCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between border-b border-white/10 pb-4 text-xs text-slate-600">
            <span>{filteredNotes.length} 篇笔记</span>
            <span>按更新时间排序</span>
          </div>

          <div className="divide-y divide-white/10">
            {filteredNotes.map((note) => (
              <Link
                className="group block py-7"
                key={note.slug}
                to={`/notes/${note.slug}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <time>{formatNoteDate(note.updated)}</time>
                      <span className="size-1 rounded-full bg-slate-700" />
                      <span>{note.category}</span>
                      <span>{note.readingMinutes} 分钟</span>
                    </div>
                    <h2 className="mt-3 text-xl font-medium text-slate-200 transition group-hover:text-cyan-200">
                      {note.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {note.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <span
                          className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-600"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="mt-8 hidden size-5 text-slate-700 transition group-hover:translate-x-1 group-hover:text-cyan-300 sm:block" />
                </div>
              </Link>
            ))}
          </div>

          {filteredNotes.length === 0 && (
            <div className="py-24 text-center">
              <p className="text-sm text-slate-500">没有找到匹配的笔记。</p>
              <button
                className="mt-4 text-sm text-cyan-300 hover:text-cyan-200"
                onClick={() => {
                  setQuery("");
                  setSearchParams({});
                }}
                type="button"
              >
                清除筛选
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
