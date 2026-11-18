/*! TradingView Lightweight Charts™
 * Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
 */
import { CandlestickSeries, ColorType, HistogramSeries, LineStyle, createChart, type AutoscaleInfo, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { MarketSignalResult, SignalInterval } from "@/lib/marketSignal";

const periodLabels = { "15m": "15 分钟", "1h": "1 小时", "4h": "4 小时" } as const;
const colors = { up: "#34d399", down: "#fb7185", entry: "#60a5fa", stop: "#fb7185", target: "#34d399", mark: "#cbd5e1" };
const date = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

export default function MarketSignalChart({ result }: { result: MarketSignalResult }) {
  const [interval, setInterval] = useState<SignalInterval>("15m");
  const container = useRef<HTMLDivElement>(null);
  const bars = result.market.chart?.find(frame => frame.interval === interval)?.candles;

  useEffect(() => {
    if (!container.current || !bars?.length) return;
    const decimals = Math.min(12, Math.max(2, ...bars.map(row => {
      const close = String(row[4]);
      const [mantissa, exponent = "0"] = close.split("e");
      return (mantissa.split(".")[1]?.length ?? 0) - Number(exponent);
    })));
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#020617" }, textColor: "#94a3b8", attributionLogo: true },
      grid: { vertLines: { color: "#172033" }, horzLines: { color: "#172033" } },
      rightPriceScale: { borderColor: "#334155" },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#334155", tickMarkFormatter: (time: Time) => date.format(Number(time) * 1000) },
      localization: { timeFormatter: (time: Time) => date.format(Number(time) * 1000) },
    });
    const { entry, stopLoss, targets } = result.opportunity;
    const levels = [result.market.latestQuote.price, ...targets.map(t => t.price)];
    if (entry) levels.push(entry.min, entry.max);
    if (stopLoss !== null) levels.push(stopLoss);
    const price = chart.addSeries(CandlestickSeries, {
      upColor: colors.up, downColor: colors.down, borderVisible: false, wickUpColor: colors.up, wickDownColor: colors.down,
      lastValueVisible: false, priceLineVisible: false, priceFormat: { type: "price", precision: decimals, minMove: 10 ** -decimals },
      autoscaleInfoProvider: (base: () => AutoscaleInfo | null) => {
        const info = base();
        if (!info?.priceRange) return info;
        return { ...info, priceRange: { minValue: Math.min(info.priceRange.minValue, ...levels), maxValue: Math.max(info.priceRange.maxValue, ...levels) } };
      },
    });
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
  }, [bars, result]);

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
    <p className="px-3 py-2 text-xs leading-5 text-slate-400">K 线为合约成交价。下方柱状图为成交量，灰线为分析结束时的标记价。</p>
  </section>;
}
