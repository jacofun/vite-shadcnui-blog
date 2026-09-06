import {
  useEffect,
  useMemo,
  useRef,
  type JSX,
} from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";

import {
  formatNoteDate,
  noteCategories,
  noteTags,
  notes,
} from "@/lib/notes";

export default function Notes(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const query = searchParams.get("q") ?? "";
  const selectedCategory = searchParams.get("category") ?? "全部";
  const selectedTag = searchParams.get("tag") ?? "全部";

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
        updateParams({ q: null });
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === "全部") next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesCategory =
        selectedCategory === "全部" || note.category === selectedCategory;
      const matchesTag = selectedTag === "全部" || note.tags.includes(selectedTag);
      const matchesQuery = !normalizedQuery || note.searchText.includes(normalizedQuery);
      return matchesCategory && matchesTag && matchesQuery;
    });
  }, [query, selectedCategory, selectedTag]);

  const activeFilterCount =
    Number(selectedCategory !== "全部") +
    Number(selectedTag !== "全部") +
    Number(Boolean(query.trim()));

  return (
    <>
      <Helmet>
        <title>全部笔记 · 彦骁的笔记</title>
        <meta content="浏览和全文搜索彦骁的技术、AI、市场与个人建站笔记。" name="description" />
        <link href="https://yanxiao.me/#/notes" rel="canonical" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">NOTES / INDEX</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">全部笔记</h1>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              搜索会覆盖标题、摘要、标签和正文；筛选状态会保留在 URL 中。
            </p>
          </div>

          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
              <input
                aria-label="全文搜索笔记"
                className="h-12 w-full rounded-xl border border-white/10 bg-[#090d17] pl-11 pr-20 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/10"
                onChange={(event) => updateParams({ q: event.target.value || null })}
                placeholder="搜索标题、正文、摘要或标签"
                ref={searchRef}
                type="search"
                value={query}
              />
              {query ? (
                <button
                  aria-label="清除搜索"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-600 hover:text-white"
                  onClick={() => updateParams({ q: null })}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-600">/</kbd>
              )}
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[11px] text-slate-600">分类</p>
              <div className="flex flex-wrap gap-2">
                {["全部", ...noteCategories].map((category) => (
                  <button
                    className={`rounded-lg px-3 py-2 text-xs transition ${selectedCategory === category ? "bg-white text-slate-950" : "border border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-200"}`}
                    key={category}
                    onClick={() => updateParams({ category })}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {noteTags.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] text-slate-600">标签</p>
                <div className="flex flex-wrap gap-2">
                  {["全部", ...noteTags].map((tag) => (
                    <button
                      className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] transition ${selectedTag === tag ? "border-cyan-300/30 bg-cyan-300/[0.1] text-cyan-200" : "border-white/10 text-slate-600 hover:border-white/20 hover:text-slate-300"}`}
                      key={tag}
                      onClick={() => updateParams({ tag })}
                      type="button"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between border-b border-white/10 pb-4 text-xs text-slate-600">
            <span>{filteredNotes.length} 篇笔记</span>
            {activeFilterCount > 0 ? (
              <button className="text-cyan-300 hover:text-cyan-200" onClick={() => setSearchParams({}, { replace: true })} type="button">
                清除 {activeFilterCount} 项筛选
              </button>
            ) : (
              <span>按更新时间排序</span>
            )}
          </div>

          <div className="divide-y divide-white/10">
            {filteredNotes.map((note) => (
              <Link className="group block py-7" key={note.slug} to={`/notes/${note.slug}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <time>{formatNoteDate(note.updated)}</time>
                      <span className="size-1 rounded-full bg-slate-700" />
                      <span>{note.category}</span>
                      <span>{note.readingMinutes} 分钟</span>
                      {note.series && <span>{note.series}</span>}
                    </div>
                    <h2 className="mt-3 text-xl font-medium text-slate-200 transition group-hover:text-cyan-200">{note.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{note.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-600" key={tag}>{tag}</span>
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
              <button className="mt-4 text-sm text-cyan-300 hover:text-cyan-200" onClick={() => setSearchParams({}, { replace: true })} type="button">清除筛选</button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
