import { ArrowLeft, FolderPlus, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { createPrivateResourceCollection } from "@/lib/privateAuth";

const fieldClass = "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10";

export default function PrivateResourceCreateCollection(): JSX.Element {
  const access = usePrivateResourceSession();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!access.session || access.session.user.role !== "owner") return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createPrivateResourceCollection(access.session, {
        title: title.trim(),
        description: description.trim(),
        tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      });
      navigate(`/resources/${result.collection.collectionId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "合集创建失败");
      setSubmitting(false);
    }
  }

  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;

  return (
    <>
      <Helmet><title>新建私人合集 · 彦骁的笔记</title><meta content="noindex,nofollow" name="robots" /></Helmet>
      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/resources"><ArrowLeft className="size-4" />返回私人资源</Link>
          <header className="mt-8">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">NEW COLLECTION</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">新建文件合集</h1>
            <p className="mt-5 text-sm leading-7 text-slate-400">合集仅对获授权账户可见，创建后即可批量上传普通文件和媒体。</p>
          </header>
          {access.session?.user.role !== "owner" ? (
            <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm text-amber-100">只有所有者可以新建合集。</div>
          ) : (
            <form className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8" onSubmit={submit}>
              <label className="block text-sm text-slate-400">合集名称<input className={fieldClass} maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
              <label className="block text-sm text-slate-400">说明（可选）<textarea className={`${fieldClass} min-h-28 resize-y`} maxLength={1000} onChange={(event) => setDescription(event.target.value)} value={description} /></label>
              <label className="block text-sm text-slate-400">标签（逗号分隔）<input className={fieldClass} onChange={(event) => setTags(event.target.value)} placeholder="视频, 资料" value={tags} /></label>
              {error && <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</div>}
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? <RefreshCw className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}{submitting ? "正在创建" : "创建合集"}</button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
