import { AlertCircle, LockKeyhole, RefreshCw } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router-dom";

interface Props {
  error?: string | null;
  status: "signed-out" | "forbidden" | "error" | "loading";
}

export default function PrivateLearningAccessState({ error, status }: Props): JSX.Element {
  const isLoading = status === "loading";
  const isSignedOut = status === "signed-out";
  const title = isLoading
    ? "正在验证访问权限"
    : isSignedOut
      ? "版权要求，请先登录"
      : status === "forbidden"
        ? "当前账户未开通学习权限"
        : "暂时无法读取学习空间";
  const description = isLoading
    ? "正在连接私人认证服务…"
    : isSignedOut
      ? "课程音频与 transcript 仅供个人学习，登录后才能访问。"
      : status === "forbidden"
        ? "请使用拥有 english-learning 权限的账户。"
        : error ?? "请稍后重试。";

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#070a12] px-6 py-20 text-slate-100">
      <section className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
          {isLoading ? (
            <RefreshCw className="size-5 animate-spin text-cyan-300" />
          ) : status === "error" ? (
            <AlertCircle className="size-5 text-rose-300" />
          ) : (
            <LockKeyhole className="size-5 text-cyan-300" />
          )}
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
        {!isLoading && (
          <div className="mt-7 flex justify-center gap-3">
            {isSignedOut && (
              <Link className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100" to="/auth">
                登录或注册
              </Link>
            )}
            <Link className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white" to="/">
              返回首页
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
