import { ArrowRight, Clock3, Cpu, LineChart, NotebookPen } from "lucide-react";
import type { JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const topics = [
  {
    icon: Cpu,
    title: "AI 与软件开发",
    description: "关注自然语言如何改变开发流程，以及代码更容易产生之后，工程判断和基础设施为什么仍然重要。",
  },
  {
    icon: NotebookPen,
    title: "个人网站",
    description: "继续把 yanxiao.me 做成一个低成本、可长期维护、内容和基础设施都尽量简单的个人空间。",
  },
  {
    icon: LineChart,
    title: "金融市场",
    description: "关注宏观环境、流动性、预期、概率和人的行为如何共同形成价格。",
  },
] as const;

export default function Now(): JSX.Element {
  return (
    <>
      <Helmet>
        <title>现在 · 彦骁的笔记</title>
        <meta content="最近正在关注的技术、AI、个人网站与金融市场问题。" name="description" />
        <link href="https://yanxiao.me/#/now" rel="canonical" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-16 sm:px-8">
          <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">NOW</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">现在</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-500">
            这里记录最近一段时间持续关注的事情，不追求频繁更新，也不把它写成动态或履历。
          </p>

          <div className="mt-12 grid gap-4">
            {topics.map(({ icon: Icon, title, description }) => (
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6" key={title}>
                <div className="flex items-start gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-medium text-white">{title}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3 border-t border-white/10 pt-8">
            <Link className="inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200" to="/notes">
              查看最近笔记
              <ArrowRight className="size-4" />
            </Link>
            <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-200" to="/timeline">
              <Clock3 className="size-4" />
              查看时间轴
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
