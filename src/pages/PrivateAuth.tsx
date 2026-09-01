import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  getPrivateAuthSession,
  logoutPrivateAuth,
  PrivateAuthApiError,
  type PrivateAuthSession,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
} from "@/lib/privateAuth";

type AuthMode = "login" | "register";
type BusyAction = "login" | "register" | "retry" | "logout" | null;
type PendingVerification = {
  credential: unknown;
  kind: "login" | "register";
};

const errorMessages: Record<string, string> = {
  AUTH_STORE_NOT_INITIALIZED: "认证服务尚未初始化，请先完成管理员初始化。",
  CHALLENGE_USED: "这次验证已经使用，请重新开始。",
  INVALID_CHALLENGE: "验证请求已经过期，请重新开始。",
  INVALID_INVITATION: "邀请码无效、已经使用或已经过期。",
  PASSKEY_VERIFICATION_FAILED: "Passkey 验证未通过，请确认使用了正确的设备。",
  RATE_LIMITED: "操作次数过多，请稍后再试。",
  UNAUTHENTICATED: "登录状态已失效，请重新登录。",
};

function readableError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Passkey 操作已取消或等待超时。";
    }
    if (error.name === "InvalidStateError") {
      return "这个 Passkey 已经注册，请使用其他设备或直接登录。";
    }
    if (error.name === "SecurityError") {
      return "当前域名或安全环境不允许使用 Passkey。";
    }
  }
  if (error instanceof PrivateAuthApiError) {
    return errorMessages[error.code] ?? error.message;
  }
  if (error instanceof TypeError) {
    return "网络连接中断，请检查连接后重试。";
  }
  return "认证操作未完成，请重新尝试。";
}

function shouldKeepVerification(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof PrivateAuthApiError && error.status >= 500);
}

export default function PrivateAuth(): JSX.Element {
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<PrivateAuthSession | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] =
    useState<PendingVerification | null>(null);
  const [invitationToken, setInvitationToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credentialName, setCredentialName] = useState("我的 Passkey");
  const supportsWebAuthn = browserSupportsWebAuthn();

  useEffect(() => {
    const controller = new AbortController();

    getPrivateAuthSession(controller.signal)
      .then((currentSession) => setSession(currentSession))
      .catch((sessionError: unknown) => {
        if (sessionError instanceof DOMException && sessionError.name === "AbortError") return;
        if (sessionError instanceof PrivateAuthApiError && sessionError.status === 401) return;
        setError(readableError(sessionError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCheckingSession(false);
      });

    return () => controller.abort();
  }, []);

  const completeVerification = async (pending: PendingVerification, action: BusyAction) => {
    setBusyAction(action);
    setError(null);
    try {
      const authenticated = pending.kind === "login"
        ? await verifyPasskeyLogin(pending.credential)
        : await verifyPasskeyRegistration(pending.credential);
      setSession(authenticated);
      setPendingVerification(null);
      setInvitationToken("");
    } catch (verificationError) {
      if (!shouldKeepVerification(verificationError)) {
        setPendingVerification(null);
      }
      setError(readableError(verificationError));
    } finally {
      setBusyAction(null);
    }
  };

  const handleLogin = async () => {
    setBusyAction("login");
    setError(null);
    setPendingVerification(null);
    try {
      const options = await beginPasskeyLogin<PublicKeyCredentialRequestOptionsJSON>();
      const credential = await startAuthentication({ optionsJSON: options.publicKey });
      const pending = { credential, kind: "login" as const };
      setPendingVerification(pending);
      await completeVerification(pending, "login");
    } catch (loginError) {
      setError(readableError(loginError));
      setBusyAction(null);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyAction("register");
    setError(null);
    setPendingVerification(null);
    try {
      const options = await beginPasskeyRegistration<PublicKeyCredentialCreationOptionsJSON>({
        invitationToken,
        displayName,
        credentialName,
      });
      const credential = await startRegistration({ optionsJSON: options.publicKey });
      const pending = { credential, kind: "register" as const };
      setPendingVerification(pending);
      await completeVerification(pending, "register");
    } catch (registrationError) {
      setError(readableError(registrationError));
      setBusyAction(null);
    }
  };

  const handleLogout = async () => {
    if (!session) return;
    setBusyAction("logout");
    setError(null);
    try {
      await logoutPrivateAuth(session);
      setSession(null);
      setMode("login");
    } catch (logoutError) {
      setError(readableError(logoutError));
    } finally {
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null;

  return (
    <>
      <Helmet>
        <title>私人内容登录 · 彦骁的笔记</title>
        <meta content="使用 Passkey 登录彦骁的私人学习栏目。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#070a12] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_8%,rgba(34,211,238,0.11),transparent_68%)]" />

        <div className="relative mx-auto grid min-h-[70vh] max-w-5xl items-center gap-12 px-6 py-20 sm:px-8 lg:grid-cols-[1fr_440px] lg:px-10 lg:py-24">
          <section className="max-w-xl">
            <p className="font-mono text-xs tracking-[0.2em] text-cyan-300">
              PRIVATE ACCESS / PASSKEY
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              私人学习空间
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">
              受版权要求限制，英语学习内容仅向获得邀请的用户开放。登录不使用密码，身份验证由设备上的 Passkey 完成。
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:max-w-md lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <ShieldCheck className="size-5 text-cyan-300" />
                <p className="mt-4 text-sm font-medium text-slate-200">抗钓鱼验证</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">Passkey 只响应 yanxiao.me 的验证请求。</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <Fingerprint className="size-5 text-violet-300" />
                <p className="mt-4 text-sm font-medium text-slate-200">本机确认</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">使用面容、指纹或设备解锁完成登录。</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#0a0e18]/95 p-1 shadow-[0_30px_100px_rgba(0,0,0,0.42)]">
            <div className="rounded-[22px] border border-white/[0.06] bg-[#080c15] p-6 sm:p-8">
              {isCheckingSession ? (
                <div aria-live="polite" className="flex min-h-80 flex-col items-center justify-center text-center">
                  <RefreshCw className="size-6 animate-spin text-cyan-300" />
                  <p className="mt-4 text-sm text-slate-500">正在检查登录状态…</p>
                </div>
              ) : session ? (
                <div className="min-h-80">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
                    <CheckCircle2 className="size-6 text-emerald-300" />
                  </div>
                  <p className="mt-7 font-mono text-xs tracking-[0.16em] text-emerald-300">AUTHENTICATED</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{session.user.displayName}</h2>
                  <dl className="mt-7 divide-y divide-white/[0.08] border-y border-white/[0.08] text-sm">
                    <div className="flex justify-between gap-4 py-4">
                      <dt className="text-slate-600">账户角色</dt>
                      <dd className="text-slate-300">{session.user.role === "owner" ? "站点所有者" : "受邀成员"}</dd>
                    </div>
                    <div className="flex justify-between gap-4 py-4">
                      <dt className="text-slate-600">学习权限</dt>
                      <dd className={session.user.permissions.includes("english-learning") ? "text-cyan-300" : "text-slate-500"}>
                        {session.user.permissions.includes("english-learning") ? "已开通" : "未开通"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-50"
                    disabled={isBusy}
                    onClick={handleLogout}
                    type="button"
                  >
                    {busyAction === "logout" ? <RefreshCw className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    退出登录
                  </button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
                    {(["login", "register"] as const).map((item) => (
                      <button
                        aria-pressed={mode === item}
                        className={`rounded-lg px-3 py-2.5 text-sm transition ${mode === item ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-300"}`}
                        key={item}
                        onClick={() => {
                          setMode(item);
                          setError(null);
                          setPendingVerification(null);
                        }}
                        type="button"
                      >
                        {item === "login" ? "Passkey 登录" : "邀请码注册"}
                      </button>
                    ))}
                  </div>

                  {!supportsWebAuthn && (
                    <div className="mt-5 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      当前浏览器不支持 WebAuthn，请使用最新版 Safari、Chrome 或 Edge。
                    </div>
                  )}

                  {mode === "login" ? (
                    <div className="py-8">
                      <div className="flex size-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                        <KeyRound className="size-6 text-cyan-300" />
                      </div>
                      <h2 className="mt-6 text-xl font-semibold text-white">使用 Passkey 登录</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        无需输入账号。系统会让你从本机或附近设备中选择已经注册的 Passkey。
                      </p>
                      <button
                        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-50"
                        disabled={isBusy || !supportsWebAuthn}
                        onClick={handleLogin}
                        type="button"
                      >
                        {busyAction === "login" ? <RefreshCw className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
                        验证并登录
                      </button>
                    </div>
                  ) : (
                    <form className="space-y-5 py-7" onSubmit={handleRegister}>
                      <div>
                        <label className="text-sm font-medium text-slate-300" htmlFor="invitation-token">邀请码</label>
                        <input
                          autoCapitalize="none"
                          autoComplete="one-time-code"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 font-mono text-sm tracking-[0.08em] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
                          id="invitation-token"
                          maxLength={16}
                          minLength={16}
                          onChange={(event) => setInvitationToken(event.target.value.trim())}
                          placeholder="16 位邀请码"
                          required
                          spellCheck={false}
                          value={invitationToken}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300" htmlFor="display-name">显示名称</label>
                        <input
                          autoComplete="name"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
                          id="display-name"
                          maxLength={80}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="用于站内展示"
                          required
                          value={displayName}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300" htmlFor="credential-name">Passkey 名称</label>
                        <input
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
                          id="credential-name"
                          maxLength={80}
                          onChange={(event) => setCredentialName(event.target.value)}
                          placeholder="例如：iPhone"
                          required
                          value={credentialName}
                        />
                      </div>
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-50"
                        disabled={isBusy || !supportsWebAuthn || invitationToken.length !== 16}
                        type="submit"
                      >
                        {busyAction === "register" ? <RefreshCw className="size-4 animate-spin" /> : <UserRound className="size-4" />}
                        注册 Passkey
                      </button>
                    </form>
                  )}

                  {error && (
                    <div aria-live="polite" className="flex gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm leading-6 text-rose-100">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="flex-1">
                        <p>{error}</p>
                        {pendingVerification && (
                          <button
                            className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-rose-200 underline decoration-rose-300/30 underline-offset-4 hover:text-white"
                            disabled={isBusy}
                            onClick={() => completeVerification(pendingVerification, "retry")}
                            type="button"
                          >
                            {busyAction === "retry" && <RefreshCw className="size-3 animate-spin" />}
                            重试提交同一次验证
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Link className="mt-7 inline-flex items-center gap-2 text-xs text-slate-600 transition hover:text-slate-300" to="/">
                <ArrowLeft className="size-3.5" />
                返回首页
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
