import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled application error", error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070a12] px-6 text-slate-100">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center shadow-2xl shadow-black/30">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200">
            <AlertTriangle className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-white">页面加载失败</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            可能是资源更新或网络异常导致。重新加载通常可以恢复。
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-100"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCcw className="size-4" />
              重新加载
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/20 hover:text-white"
              onClick={() => {
                window.location.hash = "#/";
                window.location.reload();
              }}
              type="button"
            >
              <Home className="size-4" />
              返回首页
            </button>
          </div>
        </section>
      </main>
    );
  }
}
