import { ArrowRight, BookOpenText, CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import PrivateLearningAccessState from "@/components/learning/PrivateLearningAccessState";
import { usePrivateLearningSession } from "@/hooks/usePrivateLearningSession";
import { signPrivateLearningIndex } from "@/lib/privateAuth";
import {
  fetchPrivateLearningIndex,
  type PrivateLearningIndex,
} from "@/lib/privateLearning";

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

export default function EnglishLearning(): JSX.Element {
  const access = usePrivateLearningSession();
  const [index, setIndex] = useState<PrivateLearningIndex | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (access.status !== "ready" || !access.session) return;
    const controller = new AbortController();
    setIsLoading(true);
    signPrivateLearningIndex(access.session, controller.signal)
      .then((signed) => fetchPrivateLearningIndex(signed.resources.index, controller.signal))
      .then(setIndex)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "课程列表读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [access.session, access.status]);

  if (access.status !== "ready") {
    return <PrivateLearningAccessState error={access.error} status={access.status} />;
  }

  return (
    <>
      <Helmet>
        <title>6 Minute English · 私人英语学习</title>
        <meta content="私人 BBC 6 Minute English 学习课程。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="min-h-[calc(100dvh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-3xl">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">PRIVATE ENGLISH</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">6 Minute English</h1>
            <p className="mt-5 text-base leading-8 text-slate-400">每日一课，用精听、跟读与复述积累真实英语表达。</p>
          </header>

          {isLoading && (
            <div aria-live="polite" className="mt-14 flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw className="size-4 animate-spin text-cyan-300" />
              正在读取课程…
            </div>
          )}

          {error && (
            <div className="mt-12 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</div>
          )}

          {index && index.episodes.length === 0 && (
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">暂时还没有课程。</div>
          )}

          {index && index.episodes.length > 0 && (
            <section aria-label="课程列表" className="mt-12 grid gap-5 md:grid-cols-2">
              {index.episodes.map((episode, position) => (
                <Link
                  className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.055]"
                  key={episode.episodeId}
                  to={`/learning/english/${episode.episodeId}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono text-cyan-300">#{String(index.episodes.length - position).padStart(2, "0")}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{displayDate(episode.recommendedDate)}</span>
                    </div>
                    <ArrowRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold leading-snug text-white">{episode.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-400">{episode.reason}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-xs text-cyan-200">{episode.difficulty}</span>
                    {episode.tags.slice(0, 4).map((tag) => (
                      <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-500" key={tag}>{tag}</span>
                    ))}
                  </div>
                </Link>
              ))}
            </section>
          )}

          <div className="mt-10 flex items-center gap-2 text-xs text-slate-600">
            <BookOpenText className="size-3.5" />
            音频与文字仅供个人英语学习
          </div>
        </div>
      </main>
    </>
  );
}
