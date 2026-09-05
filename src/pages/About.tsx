import type { JSX } from "react";
import { Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";

function WeChatIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9.45 4.1c-4.15 0-7.5 2.72-7.5 6.08 0 1.92 1.1 3.64 2.82 4.76l-.7 2.14 2.5-1.25c.9.28 1.86.43 2.88.43.34 0 .68-.02 1.01-.06a5.35 5.35 0 0 1-.18-1.36c0-3.35 3.02-6.07 6.75-6.07.4 0 .8.03 1.18.1C17.42 6.15 13.86 4.1 9.45 4.1Zm-2.6 4.02a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm5.2 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
      <path d="M22.05 14.84c0-2.82-2.8-5.1-6.25-5.1s-6.25 2.28-6.25 5.1 2.8 5.1 6.25 5.1c.83 0 1.62-.13 2.34-.36l2.08 1.04-.58-1.8c1.47-.94 2.41-2.38 2.41-3.98Zm-8.38-1.72a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm4.34 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  );
}

export default function About(): JSX.Element {
  return (
    <>
      <Helmet>
        <title>关于 · 彦骁的笔记</title>
        <meta
          content="关于 yanxiao.me，以及我对技术、AI 和金融市场的一些长期关注。"
          name="description"
        />
      </Helmet>

      <main className="relative min-h-screen overflow-x-clip bg-[#070a12] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_18%_8%,rgba(34,211,238,0.08),transparent_68%)]" />
        <div className="pointer-events-none absolute -right-56 top-52 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.07)_0%,rgba(139,92,246,0)_68%)]" />

        <div className="relative mx-auto max-w-3xl px-6 py-20 sm:px-8 sm:py-24 lg:py-28">
          <header className="border-b border-white/10 pb-12">
            <p className="font-mono text-xs tracking-[0.2em] text-cyan-300">
              YANXIAO.ME / ABOUT
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              关于
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
              这里是我的个人网站，也是一个准备长期维护的小项目。
            </p>
            <p className="mt-3 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
              我会记录一些技术实践、工程思考，以及偶尔觉得值得留下来的东西。相比更新频率，我更希望多年以后重新打开这里时，还能看到自己在不同阶段关注过什么。
            </p>
          </header>

          <div className="divide-y divide-white/10">
            <section className="py-12">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">
                技术与 AI
              </h2>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-400">
                <p>技术构成了我工作和生活中很重要的一部分。</p>
                <p>
                  我更习惯从实际问题出发：需要什么，就去了解什么、尝试什么，再把它真正用起来。这个网站本身也是这种方式的产物。
                </p>
                <p>
                  AI 的出现让这个过程发生了很大的变化。现在建设这个网站时，我已经很少亲手写代码。很多时候，我负责描述自己想要的结果、提出约束、判断方案是否合理，再由 AI 阅读工程并完成具体实现。
                </p>
                <p>
                  这让我越来越觉得，AI 真正有意思的地方可能不只是“会写代码”。当自然语言逐渐成为人与计算机之间新的交互方式，一些过去必须掌握具体工具才能完成的事情，开始可以通过描述目标和约束来实现。人的注意力也可以更多地放在判断、取舍和最终想得到什么上。
                </p>
                <p>
                  当然，AI 仍然只是整个系统中的一环。它会犯错，也会把简单的问题做复杂。代码变得越来越容易产生以后，如何判断一个方案是否合理、如何让系统长期可靠地运行，依然很重要。
                </p>
                <p>我也想继续看看，这种变化最终会把软件开发带到哪里。</p>
              </div>
            </section>

            <section className="py-12">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">
                金融市场
              </h2>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-400">
                <p>除了技术，我也长期关注金融市场。</p>
                <p>
                  吸引我的更多是市场背后的复杂性：宏观环境、流动性、政策、预期和人的行为相互作用，最终共同形成价格。
                </p>
                <p>
                  市场也让我一直思考一些很难回答的问题：如何区分能力与运气，如何面对概率、风险和不确定性，以及为什么一个逻辑完整的判断依然可能是错的。
                </p>
                <p>
                  这里偶尔也会记录我对这些问题的理解，仅代表个人观察与思考，不构成任何投资建议。
                </p>
              </div>
            </section>

            <section className="py-12">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">
                这个网站
              </h2>
              <div className="mt-5 space-y-5 text-base leading-8 text-slate-400">
                <p>
                  <span className="font-mono text-slate-300">yanxiao.me</span>{" "}
                  是我在 2018 年买下的域名。
                </p>
                <p>
                  它曾辗转过不同的平台，也承载过我的电子婚礼邀请函，后来才慢慢变成现在这个属于自己的长期空间。
                </p>
                <p>
                  我不打算给它规定一个非常明确的主题。技术、AI、金融市场，或者以后出现的其他兴趣，都可以成为这里的一部分。
                </p>
                <p className="pt-2 text-lg font-medium leading-8 text-slate-200">
                  这里不追求持续更新，只希望留下值得留下的东西。
                </p>
              </div>
            </section>

            <section className="py-12">
              <p className="font-mono text-xs tracking-[0.18em] text-slate-600">
                CONTACT
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white">
                联系方式
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.06]"
                  href="mailto:iam@yanxiao.me"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] text-cyan-200">
                    <Mail className="size-4.5" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-600">Email</span>
                    <span className="mt-0.5 block text-sm text-slate-300 transition group-hover:text-cyan-100">
                      iam@yanxiao.me
                    </span>
                  </span>
                </a>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300">
                    <WeChatIcon />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-600">微信</span>
                    <span className="mt-0.5 block text-sm text-slate-300">
                      微信号 official_yanxiao
                    </span>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
