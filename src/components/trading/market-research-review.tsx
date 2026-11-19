import { lazy, Suspense, useState } from "react";
import type { ResearchHours } from "@/lib/marketSignal";
import { researchPrice } from "@/lib/marketSignalDisplay";
import { formatSignalDate, type SignalReview } from "@/lib/marketSignalHistory";

const MarketReviewChart = lazy(() => import("./market-signal-chart").then(module => ({ default: module.MarketReviewChart })));
const reasons: Record<string, string> = {
  STALE_REFERENCE: "分析结束时的参考标记价已过期",
  RECORD_MISSING: "无法读取原始研究记录",
  DATA_GAP: "观察窗口内的分钟 K 线缺失或不连续",
  INVALID_MARKET_DATA: "币安返回的标记价格数据不完整",
  MARKET_RATE_LIMITED: "币安行情接口持续限流",
  MARKET_HTTP_ERROR: "币安行情接口持续返回错误",
  MARKET_TIMEOUT: "币安行情接口持续超时",
};

export default function MarketResearchReview({ reviews, preferred }: { reviews: SignalReview[]; preferred: ResearchHours }) {
  const [windowHours, setWindowHours] = useState(preferred);
  const review = reviews.find(item => item.hours === windowHours);
  if (!review) return null;
  return <section aria-label="研究复盘" className="space-y-3 rounded-xl border border-sky-300/20 bg-sky-300/[0.025] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-medium text-slate-100">研究复盘 · 分析后的标记价格</h4>
      <div role="group" aria-label="复盘窗口" className="flex flex-wrap gap-1">
        {reviews.map(item => <button key={item.hours} type="button" aria-pressed={windowHours === item.hours} onClick={() => setWindowHours(item.hours)}
          className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 aria-pressed:border-sky-300/35 aria-pressed:bg-sky-300/10 aria-pressed:text-sky-200">{item.hours} 小时</button>)}
      </div>
    </div>
    {review.status === "pending" && <p className="text-sm text-slate-400">待评估 · {formatSignalDate(review.dueAt)} 后进入队列。</p>}
    {review.status === "insufficient" && <p className="text-sm text-amber-200">数据不足 · {reasons[review.code] ?? "复盘所需数据未通过校验"}。</p>}
    {review.status === "completed" && <>
      <p className="text-xs leading-6 text-slate-400">评估覆盖 {formatSignalDate(review.observedFrom)} 至 {formatSignalDate(review.observedUntil)} 的完整 1 分钟 K 线。参考价采集于 {formatSignalDate(review.referenceTime)}。</p>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[
          ["研究参考价", researchPrice(review.referencePrice)], ["期末价格", researchPrice(review.endPrice)],
          ["最高 / 最低", `${researchPrice(review.high)} / ${researchPrice(review.low)}`],
          ["期末方向", review.directionAligned === null ? "—" : review.endPrice === review.referencePrice ? "持平" : review.directionAligned ? "一致" : "相反"],
          ["最大有利波动 MFE", review.mfePct === null ? "—" : `${review.mfePct.toFixed(2)}%`],
          ["最大不利波动 MAE", review.maePct === null ? "—" : `${review.maePct.toFixed(2)}%`],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 p-2"><dt className="text-slate-400">{label}</dt><dd className="mt-1 break-words text-slate-200">{value}</dd></div>)}
      </dl>
      {review.targets.length > 0 && <ul className="space-y-1 text-xs leading-6 text-slate-300">
        {review.targets.map((target, i) => <li key={`${target.zoneId}-${i}`}>目标 {i + 1} · {researchPrice(target.lower)} – {researchPrice(target.upper)} ·
          {target.firstTouchMinute === null ? " 未触达" : ` 首次触达所在分钟 ${formatSignalDate(target.firstTouchMinute)}`}</li>)}
      </ul>}
      <Suspense fallback={<p role="status" className="text-xs text-slate-400">正在加载后续行情…</p>}><MarketReviewChart review={review} /></Suspense>
      <p className="text-xs leading-6 text-slate-500">目标按区域触达记录，MFE 和 MAE 相对研究参考价计算。入场触发条件仍由人工确认。</p>
    </>}
  </section>;
}
