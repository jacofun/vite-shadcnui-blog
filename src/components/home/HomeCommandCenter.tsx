import { Bot, Search } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { useNavigate } from "react-router-dom";

import type { AssistantLauncherControls } from "@/components/common/PublicAiAssistant";

const suggestions = [
  "最近更新了什么？",
  "推荐几篇 AI 相关文章",
  "找出与网站建设有关的内容",
] as const;

export default function HomeCommandCenter({ ask }: AssistantLauncherControls): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim();

  function searchNotes(event?: FormEvent): void {
    event?.preventDefault();
    if (!normalizedQuery) {
      navigate("/notes");
      return;
    }
    navigate(`/notes?q=${encodeURIComponent(normalizedQuery)}`);
  }

  function askAi(): void {
    ask(normalizedQuery || "最近更新了什么？");
  }

  return (
    <div className="mt-9 max-w-3xl sm:mt-10">
      <form
        className="rounded-2xl border border-white/10 bg-white/[0.025] p-2 transition focus-within:border-cyan-300/25 focus-within:bg-white/[0.035] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        onSubmit={searchNotes}
      >
        <label className="flex min-w-0 items-center gap-3 px-3 py-1" htmlFor="home-intent">
          <Search className="size-4 shrink-0 text-slate-600" />
          <input
            autoComplete="off"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600 sm:text-base"
            id="home-intent"
            maxLength={140}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索笔记，或描述你想了解的内容……"
            type="text"
            value={query}
          />
        </label>
        <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-1 pt-2 sm:border-0 sm:px-0 sm:pt-0">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 sm:text-sm"
            type="submit"
          >
            <Search className="size-3.5" />搜索笔记
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3.5 text-xs font-medium text-slate-950 transition hover:bg-cyan-200 sm:text-sm"
            onClick={askAi}
            type="button"
          >
            <Bot className="size-3.5" />问 AI
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {suggestions.map((suggestion) => (
          <button
            className="text-left text-xs text-slate-600 transition hover:text-cyan-300"
            key={suggestion}
            onClick={() => ask(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-slate-700">
        AI 根据本站公开内容回答，生成结果仅供参考。
      </p>
    </div>
  );
}
