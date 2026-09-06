import type { JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const milestones = [
  {
    year: "2018",
    title: "买下 yanxiao.me",
    description: "从一个域名开始，先保留一个属于自己的长期入口。",
  },
  {
    year: "2021",
    title: "尝试新的托管方式",
    description: "域名和站点经历过不同平台，也开始把它当作一个可以长期折腾的小项目。",
  },
  {
    year: "2025",
    title: "电子婚礼邀请函",
    description: "这个域名第一次承载了一段明确的人生记忆，后来被保留下来成为婚礼纪念页面。",
  },
  {
    year: "2026",
    title: "重新成为个人网站",
    description: "网站逐渐形成公开笔记、私人资源、关于与纪念页面，并开始大量使用 AI 参与设计、实现和维护。",
  },
] as const;

export default function Timeline(): JSX.Element {
  return (
    <>
      <Helmet>
        <title>时间轴 · 彦骁的笔记</title>
        <meta content="yanxiao.me 从域名到个人网站的一些重要节点。" name="description" />
        <link href="https://yanxiao.me/#/timeline" rel="canonical" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-16 sm:px-8">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/now">
            <ArrowLeft className="size-4" />
            返回现在
          </Link>

          <p className="mt-10 font-mono text-xs tracking-[0.18em] text-cyan-300">TIMELINE</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">时间轴</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-500">
            记录这个网站如何变化，也记录一些值得留下来的阶段。
          </p>

          <div className="relative mt-14 border-l border-white/10 pl-8 sm:pl-10">
            {milestones.map((item, index) => (
              <section className={index === milestones.length - 1 ? "pb-2" : "pb-12"} key={`${item.year}-${item.title}`}>
                <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border border-cyan-200/40 bg-[#070a12] shadow-[0_0_0_4px_rgba(34,211,238,0.05)]" />
                <time className="font-mono text-xs tracking-[0.14em] text-cyan-300">{item.year}</time>
                <h2 className="mt-2 text-xl font-medium text-white">{item.title}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{item.description}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
