/*! TradingView Lightweight Charts™
 * Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
 */
import { CandlestickSeries, ColorType, HistogramSeries, LineStyle, createChart, type AutoscaleInfo, type IChartApi, type IPrimitivePaneRenderer, type ISeriesApi, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { MarketSignalResult, SignalInterval, SignalPriceZone } from "@/lib/marketSignal";
import type { SignalReview } from "@/lib/marketSignalHistory";
import { zoneKind, zoneRange } from "@/lib/marketSignalDisplay";

const periodMs = { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000 };
const periodLabels = { "15m": "15 分钟", "1h": "1 小时", "4h": "4 小时" } as const;

const colors = { up: "#34d399", down: "#fb7185", entry: "#60a5fa", stop: "#fb7185", target: "#34d399", mark: "#cbd5e1" };
const date = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

const bandColor = (zone: SignalPriceZone) => zone.status === "broken" ? "rgba(148, 163, 184, .10)" :
  zoneKind(zone) === "支撑" ? "rgba(52, 211, 153, .14)" : "rgba(251, 146, 60, .16)";

type Band = { lower: number; upper: number; color: string; confirmBar?: UTCTimestamp };
function mountBands(chart: IChartApi, series: ISeriesApi<"Candlestick">, bands: Band[]) {
  const renderer: IPrimitivePaneRenderer = {
    draw() {},
    drawBackground(target) {
      target.useMediaCoordinateSpace(({ context, mediaSize }) => {
        for (const band of bands) {
          const top = series.priceToCoordinate(band.upper);
          const bottom = series.priceToCoordinate(band.lower);
          const confirmed = band.confirmBar === undefined ? 0 : chart.timeScale().timeToCoordinate(band.confirmBar);
          if (top === null || bottom === null || confirmed === null || confirmed >= mediaSize.width) continue;
          const left = Math.max(0, confirmed);
          context.fillStyle = band.color;
          context.fillRect(left, top, mediaSize.width - left, Math.max(1, bottom - top));
        }
      });
    },
  };
  series.attachPrimitive({ paneViews: () => [{ zOrder: () => "bottom", renderer: () => renderer }] });
}

function createSignalChart(container: HTMLDivElement) {
  return createChart(container, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: "#020617" }, textColor: "#94a3b8", attributionLogo: true },
    grid: { vertLines: { color: "#172033" }, horzLines: { color: "#172033" } },
    rightPriceScale: { borderColor: "#334155" },
    timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#334155", tickMarkFormatter: (time: Time) => date.format(Number(time) * 1000) },
    localization: { timeFormatter: (time: Time) => date.format(Number(time) * 1000) },
  });
}

export default function MarketSignalChart({ result }: { result: MarketSignalResult }) {
  const [interval, setInterval] = useState<SignalInterval>("15m");
  const container = useRef<HTMLDivElement>(null);
  const bars = result.market.chart?.find(frame => frame.interval === interval)?.candles;

  const zones = result.research?.priceZones.filter(zone => zone.interval === interval);

  useEffect(() => {
    if (!container.current || !bars?.length) return;
    const tick = result.market.tickSize;
    const decimals = tick ? Math.min(16, Math.max(0, -Math.floor(Math.log10(tick))) + 2) :
      Math.min(12, Math.max(2, 4 - Math.floor(Math.log10(result.market.latestQuote.price))));
    const priceLabel = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: decimals, useGrouping: false });
    const chart = createSignalChart(container.current);
    const { entry, stopLoss, targets } = result.opportunity;
    const currentZones = result.research?.priceZones.filter(zone => zone.interval === interval) ?? [];
    const levels = [result.market.latestQuote.price, ...targets.map(t => t.price)];
    for (const zone of currentZones) levels.push(zone.lower, zone.upper);
    if (entry) levels.push(entry.min, entry.max);
    if (stopLoss !== null) levels.push(stopLoss);
    const price = chart.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderVisible: false, wickUpColor: colors.up, wickDownColor: colors.down,
      lastValueVisible: false, priceLineVisible: false,
      priceFormat: { type: "custom", minMove: tick ?? 10 ** -decimals, formatter: (value: number) => priceLabel.format(value) },
      autoscaleInfoProvider: (base: () => AutoscaleInfo | null) => {
        const info = base();
        if (!info?.priceRange) return info;
        return { ...info, priceRange: { minValue: Math.min(info.priceRange.minValue, ...levels), maxValue: Math.max(info.priceRange.maxValue, ...levels) } };
      },
    });
    mountBands(chart, price, currentZones.map(zone => ({ lower: zone.lower, upper: zone.upper, color: bandColor(zone),
      confirmBar: ((zone.confirmedAt - periodMs[zone.interval]) / 1000) as UTCTimestamp })));
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
    chart.panes()[1]?.setHeight(80);
    price.setData(bars.map(([ms, open, high, low, close]) => ({ time: (ms / 1000) as UTCTimestamp, open, high, low, close })));
    volume.setData(bars.map(([ms, open, , , close, value]) => ({ time: (ms / 1000) as UTCTimestamp, value, color: close >= open ? colors.up : colors.down })));

    function line(value: number, title: string, color: string) {
      price.createPriceLine({ price: value, color, title, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true });
    }
    if (entry) {
      line(entry.min, entry.min === entry.max ? "入场" : "入场下限", colors.entry);
      if (entry.min !== entry.max) line(entry.max, "入场上限", colors.entry);
    }
    if (stopLoss !== null) line(stopLoss, "止损", colors.stop);
    targets.forEach(({ price }, index) => line(price, `目标 ${index + 1}`, colors.target));
    line(result.market.latestQuote.price, "复核标记价", colors.mark);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, bars.length - 60), to: bars.length + 2 });
    return () => chart.remove();
  }, [bars, interval, result]);

  return <section aria-label="本次分析行情" className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="K 线周期">
        {(Object.keys(periodLabels) as SignalInterval[]).map(period => <button key={period} type="button" aria-pressed={interval === period}
          className={`rounded-md px-2.5 py-1.5 text-xs ${interval === period ? "bg-violet-300/15 text-violet-100" : "text-slate-400 hover:bg-white/5"}`}
          onClick={() => setInterval(period)}>{periodLabels[period]}</button>)}
      </div>
      <span className="text-xs text-slate-400">行情快照 {result.market.asOf ? date.format(result.market.asOf) : "—"} · {bars?.length ?? 0} 根已收盘 K 线</span>
    </div>
    <div ref={container} className="h-[360px] w-full sm:h-[420px]" />
    {zones && zones.length > 0 && <details className="px-3 pt-2 text-xs text-slate-400">
      <summary className="cursor-pointer">本周期价格带 · {zones.length} 个区域</summary>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{zones.map(zone => <span key={zone.id}><span className="mr-1 inline-block size-2 rounded-sm" style={{ backgroundColor: bandColor(zone) }} />{zone.interval} {zoneKind(zone)} {zoneRange(zone)}{zone.status === "broken" ? "（已突破）" : ""}</span>)}</div>
    </details>}
    <p className="px-3 py-2 text-xs leading-5 text-slate-400">K 线为合约成交价。下方柱状图为成交量，灰线为分析结束时的标记价。{result.schemaVersion === 4 && "价格带从该区域最后一根确认 K 线开始绘制。"}</p>
  </section>;
}

export function MarketReviewChart({ review }: { review: Extract<SignalReview, { status: "completed" }> }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !review.candles.length) return;
    const chart = createSignalChart(container.current);
    const precision = Math.min(14, Math.max(2, 5 - Math.floor(Math.log10(review.referencePrice))));
    const price = chart.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderVisible: false, wickUpColor: colors.up, wickDownColor: colors.down,
      lastValueVisible: false, priceLineVisible: false, priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
    mountBands(chart, price, review.targets.map(target => ({ lower: target.lower, upper: target.upper, color: "rgba(167, 139, 250, .14)" })));
    price.setData(review.candles.map(([ms, open, high, low, close]) => ({ time: (ms / 1000) as UTCTimestamp, open, high, low, close })));
    price.createPriceLine({ price: review.referencePrice, title: "研究参考价", color: colors.mark, lineStyle: LineStyle.Dashed, lineWidth: 1 });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [review]);
  return <div ref={container} className="h-[280px] w-full overflow-hidden rounded-lg border border-white/10 sm:h-[340px]" />;
}
