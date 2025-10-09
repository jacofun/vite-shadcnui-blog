import type { JSX } from "react";
import { useState } from "react"


import CountdownTimer from "@/components/CountdownTimer";
import { Calendar } from "@/components/ui/calendar";
import { zhCN } from "date-fns/locale";
import { MapPin, RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";
import { motion } from 'framer-motion'

const AMAP_NAV_URL = "https://m.amap.com/navi/?dest=106.076318,38.018922&destName=%E9%9D%92%E9%93%9C%E5%B3%A1%E5%AE%BE%E9%A6%86%E4%BA%8C%E5%B1%82%E5%A5%A5%E6%96%AF%E5%8D%A1%E5%8E%85&hideRouteIcon=1&key=2f0ec297c02b58b342d65c080d21a976&jscodeaa83216f5d8d79b5246397c78e7284df=aa83216f5d8d79b5246397c78e7284df&aa83216f5d8d79b5246397c78e7284df=";
const EVENT_DATE = new Date("2025-10-19T00:00:00");





export default function ScheduleSection(): JSX.Element {
  const [iframeKey, setIframeKey] = useState(0);
  const reloadIframe = () => {
    // 改变 key 让 React 销毁旧 iframe，重新挂载一个新的
    setIframeKey((prev) => prev + 1)
  }
  return (
    <section
      id="schedule"
      data-section="schedule"
      className="flex w-full flex-col items-center gap-10 px-6 py-16 sm:px-12 sm:py-20"
    >
      <div className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.6em] text-muted-foreground">
          Schedule
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
          className="text-3xl font-semibold tracking-[0.2em] text-foreground  sm:text-4xl">
          日程
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
          className="text-base text-muted-foreground">
          人的一生有三万多天 <br />
          很开心这一天 <br />
          你专门为我们而来 <br />
          请准备好你的好心情和好胃口 <br />
          来奔赴这场冬日的聚会的叭~
        </motion.p>
      </div>

      <div className="w-full max-w-3xl space-y-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
        >
          <CountdownTimer targetDate={EVENT_DATE} />
        </motion.div>

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
        <div className="text-center">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4 text-bg/10" />
            <p className="text-base uppercase tracking-[0.4em] text-muted-foreground">
              宴会地址
            </p>
          </span>
          <span className="inline-flex text-xs uppercase tracking-[0.4em] text-muted-foreground">
            宁夏·吴忠·青铜峡宾馆 二层奥斯卡厅
          </span>

        </div>
        <Button
          size="default"
          variant="default"
          className="bg-white text-black select-none transition-transform focus-visible:ring-white/60 hover:bg-white active:scale-[0.95] active:bg-rose-100/80"
          onClick={reloadIframe}
        >
          <RefreshCcw className="size-4" />
          重置地图
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
          className="overflow-hidden rounded-3xl border select-none border-border/40 shadow-sm pointer-events-none">
          <iframe
            key={iframeKey}
            title="青铜峡宾馆导航"
            src={AMAP_NAV_URL}
            className="h-[320px] w-full pointer-events-auto"
            allowFullScreen
            loading="lazy"
          />
        </motion.div>


      </div>
    </section>
  );
}
