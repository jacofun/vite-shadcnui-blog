import { ArrowLeft, Clipboard } from "lucide-react";
import type { JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import PrivateClipboardContent from "@/components/resources/PrivateClipboard";
import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";

export default function PrivateClipboard(): JSX.Element {
  const access = usePrivateResourceSession();

  if (access.status !== "ready") {
    return <PrivateResourceAccessState error={access.error} status={access.status} />;
  }

  const canWrite = access.session?.user.role === "owner" ||
    access.session?.user.permissions.includes("private-resources-write") === true;

  return (
    <>
      <Helmet>
        <title>文本剪贴板 · 私人资源</title>
        <meta content="在授权设备之间保存和复制私人文本。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/resources">
            <ArrowLeft className="size-4" />返回私人资源
          </Link>
          <header className="mt-8">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-cyan-300">
              <Clipboard className="size-4" />PRIVATE CLIPBOARD
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">文本剪贴板</h1>
            <p className="mt-5 text-base leading-8 text-slate-400">文本保存在私人 OSS，可在已授权设备之间复制使用。</p>
          </header>

          {access.session && <PrivateClipboardContent canWrite={canWrite} session={access.session} />}
        </div>
      </main>
    </>
  );
}
