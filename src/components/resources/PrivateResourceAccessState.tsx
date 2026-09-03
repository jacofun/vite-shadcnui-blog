import { AlertCircle, LockKeyhole, RefreshCw } from "lucide-react";
import { useState, type JSX } from "react";
import { Link } from "react-router-dom";

import PrivateLoadingProgress from "@/components/resources/PrivateLoadingProgress";
import { usePrivateAuth } from "@/hooks/usePrivateAuth";

interface Props {
  error?: string | null;
  status: "signed-out" | "forbidden" | "error" | "loading";
}

export default function PrivateResourceAccessState({ error, status }: Props): JSX.Element {
  const { ensureSession } = usePrivateAuth();
  const [retrying, setRetrying] = useState(false);
  const isLoading = status === "loading";
  const isSignedOut = status === "signed-out";
  const title = isLoading
    ? "正在验证访问权限"
    : isSignedOut
      ? "私人资源，请先登录"
      : status === "forbidden"
        ? "当前账户未开通私人资源权限"
        : "暂时无法读取私人资源";
  const description = isLoading
    ? "正在连接私人认证服务…"
    : isSignedOut
      ? "受版权和隐私限制，登录后才能访问这里的内容。"
      : status === "forbidden"
        ? "请使用拥有 private-resources 权限的账户。"
        : error ?? "请稍后重试。";

  async function retry(): Promise<void> {
    if (retrying) return;
    setRetrying(true);
    try {
      await ensureSession(true);
    } catch {
      // The provider keeps the latest error for this state view.
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-20 text-slate-100">
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
        <PrivateLoadingProgress className="mt-7 text-left" label="正在连接私人认证服务" loading={isLoading} />
        {!isLoading && (
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {isSignedOut && (
              <Link className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100" to="/auth">
                登录或注册
              </Link>
            )}
            {status === "error" && (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
                disabled={retrying}
                onClick={() => void retry()}
                type="button"
              >
                <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
                重新连接
              </button>
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
