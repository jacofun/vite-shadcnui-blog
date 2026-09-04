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
  Fingerprint,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";

import PrivateLoadingProgress from "@/components/resources/PrivateLoadingProgress";
import { usePrivateAuth } from "@/hooks/usePrivateAuth";
import {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  PrivateAuthApiError,
  verifyPasskeyLogin,
  verifyPasskeyRegistration,
} from "@/lib/privateAuth";

type AuthMode = "login" | "register";
type BusyAction = "login" | "register" | "retry" | null;
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
    if (error.name === "NotAllowedError") return "Passkey 操作已取消或等待超时。";
    if (error.name === "InvalidStateError") return "这个 Passkey 已经注册，请使用其他设备或直接登录。";
    if (error.name === "SecurityError") return "当前域名或安全环境不允许使用 Passkey。";
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

function isWeChatBrowser(): boolean {
  return /MicroMessenger/i.test(window.navigator.userAgent);
}

export default function PrivateAuth(): JSX.Element {
  const {
    ensureSession,
    session,
    setAuthenticatedSession,
    status: authStatus,
  } = usePrivateAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [invitationToken, setInvitationToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credentialName, setCredentialName] = useState("我的 Passkey");
  const isWeChat = isWeChatBrowser();
  const supportsWebAuthn = browserSupportsWebAuthn();
  const isCheckingSession = !isWeChat && (authStatus === "idle" || authStatus === "loading");

  useEffect(() => {
    if (!isWeChat && authStatus === "idle") {
      void ensureSession().catch((sessionError: unknown) => setError(readableError(sessionError)));
    }
  }, [authStatus, ensureSession, isWeChat]);

  useEffect(() => {
    if (!isWeChat && session) {
      navigate("/resources", { replace: true });
    }
  }, [isWeChat, navigate, session]);

  const completeVerification = async (pending: PendingVerification, action: BusyAction) => {
    setBusyAction(action);
    setError(null);
    try {
      const authenticated = pending.kind === "login"
        ? await verifyPasskeyLogin(pending.credential)
        : await verifyPasskeyRegistration(pending.credential);
      setAuthenticatedSession(authenticated);
      setPendingVerification(null);
      setInvitationToken("");
      navigate("/resources", { replace: true });
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

  const isBusy = busyAction !== null;

  return (
    <>
      <Helmet>
        <title>私人内容登录 · 彦骁的笔记</title>
        <meta content="使用 Passkey 登录彦骁的私人资源空间。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-[#070a12] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_8%,rgba(34,211,238,0.11),transparent_68%)]" />

        <div className="relative mx-auto flex h-full max-w-md items-center px-5 py-3 sm:px-0 sm:py-5">
          <section className="max-h-full w-full overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#0a0e18]/95 p-1 shadow-[0_30px_100px_rgba(0,0,0,0.42)]">
            <div className="rounded-[22px] border border-white/[0.06] bg-[#080c15] p-4 sm:p-6">
              <div className="mb-4">
                <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">PRIVATE ACCESS</p>
                <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-white">私人资源空间</h1>
              </div>

              {isWeChat ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <div className="flex gap-3 text-sm leading-6 text-amber-100">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">当前微信浏览器暂不支持登录</p>
                      <p className="mt-1 text-xs leading-5 text-amber-100/70">
                        本站使用 Passkey 进行身份验证。请点击微信右上角「···」，选择「在默认浏览器打开」后继续。
                      </p>
                    </div>
                  </div>
                </div>
              ) : isCheckingSession || session ? (
                <div aria-live="polite" className="flex min-h-48 flex-col items-center justify-center text-center">
                  <PrivateLoadingProgress label={session ? "正在进入私人资源" : "正在检查登录状态"} loading />
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-1">
                    {(["login", "register"] as const).map((item) => (
                      <button
                        aria-pressed={mode === item}
                        className={`rounded-lg px-3 py-2 text-sm transition ${mode === item ? "bg-white/10 text-white" : "text-slate-600 hover:text-slate-300"}`}
                        key={item}
                        onClick={() => {
                          setMode(item);
                          setError(null);
                          setPendingVerification(null);
                        }}
                        type="button"
                      >
                        {item === "login" ? "登录" : "注册"}
                      </button>
                    ))}
                  </div>

                  {!supportsWebAuthn && (
                    <div className="mt-5 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      当前浏览器不支持 Passkey。
                    </div>
                  )}

                  {mode === "login" ? (
                    <div className="pt-3">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-50"
                        disabled={isBusy || !supportsWebAuthn}
                        onClick={handleLogin}
                        type="button"
                      >
                        {busyAction === "login" ? <RefreshCw className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
                        使用 Passkey 登录
                      </button>
                    </div>
                  ) : (
                    <form className="space-y-2.5 pt-3" onSubmit={handleRegister}>
                      <div>
                        <label className="text-xs font-medium text-slate-300" htmlFor="invitation-token">邀请码</label>
                        <input autoCapitalize="none" autoComplete="one-time-code" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 font-mono text-base tracking-[0.08em] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10" id="invitation-token" maxLength={16} minLength={16} onChange={(event) => setInvitationToken(event.target.value.trim())} placeholder="16 位邀请码" required spellCheck={false} value={invitationToken} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-300" htmlFor="display-name">显示名称</label>
                        <input autoComplete="name" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-base text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10" id="display-name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder="用于站内展示" required value={displayName} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-300" htmlFor="credential-name">Passkey 名称</label>
                        <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-base text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10" id="credential-name" maxLength={80} onChange={(event) => setCredentialName(event.target.value)} placeholder="例如：iPhone" required value={credentialName} />
                      </div>
                      <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-50" disabled={isBusy || !supportsWebAuthn || invitationToken.length !== 16} type="submit">
                        {busyAction === "register" ? <RefreshCw className="size-4 animate-spin" /> : <UserRound className="size-4" />}
                        注册 Passkey
                      </button>
                    </form>
                  )}

                  {error && (
                    <div aria-live="polite" className="mt-3 flex gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm leading-6 text-rose-100">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div className="flex-1">
                        <p>{error}</p>
                        {pendingVerification && (
                          <button className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-rose-200 underline decoration-rose-300/30 underline-offset-4 hover:text-white" disabled={isBusy} onClick={() => completeVerification(pendingVerification, "retry")} type="button">
                            {busyAction === "retry" && <RefreshCw className="size-3 animate-spin" />}
                            重试提交同一次验证
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Link className="mt-4 inline-flex items-center gap-2 text-xs text-slate-600 transition hover:text-slate-300" to="/">
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
