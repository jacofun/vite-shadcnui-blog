import type { JSX } from "react";

import { Calendar } from "@/components/ui/calendar";
import { zhCN } from "date-fns/locale";

const AMAP_NAV_URL = "https://m.amap.com/navi/?dest=106.076318,38.018922&destName=%E9%9D%92%E9%93%9C%E5%B3%A1%E5%AE%BE%E9%A6%86%E4%BA%8C%E5%B1%82%E5%A5%A5%E6%96%AF%E5%8D%A1%E5%8E%85&hideRouteIcon=1&key=2f0ec297c02b58b342d65c080d21a976&jscodeaa83216f5d8d79b5246397c78e7284df=aa83216f5d8d79b5246397c78e7284df&aa83216f5d8d79b5246397c78e7284df=";
const EVENT_DATE = new Date("2025-10-19T00:00:00");

export default function ScheduleSection(): JSX.Element {
  return (
    <section
      id="schedule"
      data-section="schedule"
      className="flex w-full flex-col items-center gap-10 px-6 py-16 sm:px-12 sm:py-20"
    >
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.6em] text-muted-foreground">
          Wedding Schedule
        </p>
        <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
          日程安排
        </h2>
        <p className="text-base text-muted-foreground">
          与您一同记录心动细节
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-10">
        <div className="rounded-3xl border border-border/40 bg-background/100 p-6 shadow-sm backdrop-blur">
          <Calendar
            mode="single"
            selected={EVENT_DATE}
            defaultMonth={EVENT_DATE}
            modifiers={{ highlighted: EVENT_DATE }}
            locale={zhCN}
            weekStartsOn={1}
            modifiersClassNames={{ highlighted: "bg-primary/10 text-primary font-bold rounded-md" }}
            disabled={{ before: EVENT_DATE, after: EVENT_DATE }}
            className="w-full mx-auto"
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-border/40 shadow-sm">
          <iframe
            title="青铜峡宾馆导航"
            src={AMAP_NAV_URL}
            className="h-[320px] w-full"
            allowFullScreen
            loading="lazy"
          />
        </div>
        <div className="rounded-3xl border border-border/40 bg-background/80 p-6 shadow-sm backdrop-blur">
          <ul className="space-y-4 text-base text-foreground/90 font-mono">
            <li className="flex items-baseline gap-3">
              <span className=" text-foreground ">10:48</span>
              <span>迎宾接待</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="text-foreground">11:28</span>
              <span>典礼开始</span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="text-foreground">12:00</span>
              <span>祝酒午宴</span>
            </li>
          </ul>
        </div>
        
      </div>
    </section>
  );
}
