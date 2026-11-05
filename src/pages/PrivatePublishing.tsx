import { ROUTE_NAVIGATION_CANCELLED_EVENT } from "@/lib/routePrefetch";
import { useEffect, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import MarkdownRenderer from "@/components/notes/MarkdownRenderer";
import PublishingVideo from "@/components/common/PublishingVideo";
import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { publishingRequest, type PublishingAsset, type PublishingEntry, type PublishingUploadFormat } from "@/lib/publishing";
import type { PrivateAuthSession, PrivateResourceUploadTarget } from "@/lib/privateAuth";
import { uploadPrivateResourceFile } from "@/lib/privateResourceUpload";
const blank = (): PublishingEntry => ({ id: "", version: 0, title: "", summary: "", body: "", type: "article", assetIds: [], published: null });
const field = "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-slate-100";
const button = "rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-40";
export default function PrivatePublishing() {
  const access = usePrivateResourceSession();
  if (access.status !== "ready") return <PrivateResourceAccessState status={access.status} error={access.error} />;
  if (access.session?.user.role !== "owner") return <PrivateResourceAccessState status="forbidden" error={null} />;
  return <Editor session={access.session} />;
}
function Editor({ session }: { session: PrivateAuthSession }) {
  const [entries, setEntries] = useState<PublishingEntry[]>([]);
  const [assets, setAssets] = useState<PublishingAsset[]>([]);
  const [uploadFormats, setUploadFormats] = useState<PublishingUploadFormat[]>([]);
  const [draft, setDraft] = useState(blank);
  const [baseline, setBaseline] = useState(JSON.stringify(blank()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [pendingUpload, setPendingUpload] = useState<{ file: File; uploadToken: string; files: { file: PrivateResourceUploadTarget } } | null>(null);
  const [preview, setPreview] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("当前修改尚未保存，确定离开吗？")) blocker.proceed();
    else { blocker.reset(); window.dispatchEvent(new Event(ROUTE_NAVIGATION_CANCELLED_EVENT)); }
  }, [blocker]);
  useEffect(() => {
    let active = true;
    publishingRequest<{ entries: PublishingEntry[]; assets: PublishingAsset[]; uploadFormats?: PublishingUploadFormat[] }>("list", {}, session).then(data => { if (active) { setEntries(data.entries); setAssets(data.assets); setUploadFormats(data.uploadFormats ?? []); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [session]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function select(entry: PublishingEntry) {
    if (dirty && !window.confirm("当前修改尚未保存，确定切换吗？")) return;
    setDraft(entry); setBaseline(JSON.stringify(entry)); setError(""); setMessage("");
  }
  function updateEntry(entry: PublishingEntry) { setDraft(entry); setBaseline(JSON.stringify(entry)); setEntries(old => [entry, ...old.filter(e => e.id !== entry.id)]); }
  async function act(operation: "save" | "publish" | "unpublish") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      let current = draft;
      if (operation === "save" || (operation === "publish" && (dirty || !current.id))) {
        current = (await publishingRequest<{ entry: PublishingEntry }>("save", { id: current.id || undefined, version: current.version, title: current.title, summary: current.summary, body: current.body, type: current.type, assetIds: current.assetIds }, session)).entry;
        updateEntry(current);
      }
      if (operation !== "save") {
        if (operation === "publish" && !window.confirm("确认将这篇内容和选中的素材公开给所有访客？")) return;
        current = (await publishingRequest<{ entry: PublishingEntry }>(operation, { id: current.id, version: current.version }, session)).entry;
        if (operation === "unpublish" && dirty) {
          setDraft({ ...draft, version: current.version, published: null });
          setBaseline(JSON.stringify(current));
          setEntries(old => [current, ...old.filter(e => e.id !== current.id)]);
        } else updateEntry(current);
      }
      setMessage(operation === "publish" ? "已发布，访客可以查看。" : operation === "unpublish" ? "已撤下；此前已打开的媒体链接会在 CDN 有效期后失效。" : "草稿已保存，尚未公开新修改。");
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }
  async function upload(files: FileList | File[] | null) {
    if (!files?.length || busy) return;
    setBusy(true); setError("");
    try {
      for (const file of Array.from(files)) {
        const extension = file.name.trim().split(".").pop()?.toLowerCase();
        const rule = uploadFormats.find(format => format.extension === extension);
        if (uploadFormats.length && !rule) throw new Error(`${file.name}：不支持此文件格式，请查看下方支持的格式列表。`);
        if (rule && (file.size < 1 || file.size > rule.maxBytes)) throw new Error(`${file.name}：文件为空或超过大小限制，图片上限 20MB，视频上限 1GB。`);
        const retry = pendingUpload?.file === file;
        const initialized = retry ? pendingUpload : await publishingRequest<{ uploadToken: string; files: { file: PrivateResourceUploadTarget } }>("upload-init", { name: file.name, bytes: file.size }, session);
        setPendingUpload({ ...initialized, file });
        await uploadPrivateResourceFile(file, initialized.files.file, ({ loaded, total }) => setProgress(`${file.name} · ${Math.round(loaded / Math.max(total, 1) * 100)}%`), { allowExisting: retry });
        const { asset } = await publishingRequest<{ asset: PublishingAsset }>("upload-complete", { uploadToken: initialized.uploadToken }, session);
        setPendingUpload(null);
        setAssets(old => [asset, ...old.filter(a => a.id !== asset.id)]);
        setDraft(old => ({ ...old, assetIds: old.assetIds.length < 12 ? [...old.assetIds, asset.id] : old.assetIds }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : "上传失败"); }
    finally { setBusy(false); setProgress(""); }
  }
  return <main className="min-h-screen bg-[#070a12] px-5 py-10 text-slate-100">
    <Helmet><title>内容发布 · 私人资源</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="mx-auto max-w-6xl">
      <Link to="/resources" className="text-sm text-cyan-200">← 私人资源</Link>
      <h1 className="mt-7 text-3xl">内容发布</h1><p className="mt-3 text-sm leading-7 text-slate-400">写文章、发组图或视频。先保存草稿，确认后发布到公开页面。</p>
      {error && <p role="alert" className="mt-5 text-rose-300">{error}</p>}{message && <p role="status" className="mt-5 text-emerald-200">{message}</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside><button className={button} disabled={busy} onClick={() => select(blank())}>＋ 新建内容</button><div className="mt-5 space-y-2">{entries.map(entry => <button className="block w-full rounded-lg border border-white/10 p-3 text-left text-sm disabled:opacity-40" disabled={busy} key={entry.id} onClick={() => select(entry)}><span className="block break-words">{entry.title}</span><span className="mt-1 block text-xs text-slate-400">{entry.published ? "已发布 · 可继续编辑草稿" : "草稿"}</span></button>)}</div></aside>
        <section className="min-w-0 space-y-5"><fieldset disabled={busy} className="min-w-0 space-y-5 disabled:opacity-60">
          <label className="block space-y-2"><span>内容类型</span><select className={field} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as "article" | "moment" })}><option value="article">文章</option><option value="moment">图片 / 视频碎片</option></select></label>
          <label className="block space-y-2"><span>标题</span><input maxLength={200} className={field} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="block space-y-2"><span>简介（可选）</span><input maxLength={500} className={field} value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></label>
          <label className="block space-y-2"><span>正文（支持 Markdown，可选）</span><textarea rows={12} maxLength={30000} className={field} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></label>
          <label className="block space-y-2"><span>上传图片或视频</span><input className={field} type="file" accept={uploadFormats.length ? uploadFormats.map(format => `.${format.extension}`).join(",") : "image/jpeg,image/png,image/webp,video/mp4"} multiple onChange={e => { void upload(e.target.files); e.target.value = ""; }} /><span className="block text-xs text-slate-400">图片不超过 20MB，视频不超过 1GB；每篇最多选择 12 项素材，第一张选中的图片用于列表展示。不上传图片也可发布文章。</span></label>
          {uploadFormats.length > 0 && <details className="text-xs leading-6 text-slate-400"><summary className="cursor-pointer">支持的格式与播放说明</summary><p className="mt-2 break-words">{uploadFormats.map(format => format.extension.toUpperCase()).join("、")}</p><p>视频以原格式保存，网页播放取决于浏览器和视频编码。无法播放时可打开或下载原文件；如需方便跨设备播放，可先转为 H.264 / AAC 编码的 MP4。</p></details>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{assets.map(asset => <div key={asset.id} className="min-w-0 rounded-lg border border-white/10 p-2"><label className="text-xs"><input type="checkbox" checked={draft.assetIds.includes(asset.id)} onChange={e => setDraft({ ...draft, assetIds: e.target.checked ? [...draft.assetIds, asset.id].slice(0, 12) : draft.assetIds.filter(id => id !== asset.id) })} /> {asset.kind === "image" ? "图片" : "视频"}</label>{asset.kind === "image" ? <img className="mt-2 aspect-video w-full object-cover" src={asset.url} alt={asset.name} loading="lazy" /> : <PublishingVideo className="mt-2 aspect-video w-full" src={asset.url} name={asset.name} />}<span className="mt-2 block truncate text-xs text-slate-400">{asset.name}</span></div>)}</div>
        </fieldset>
        {progress && <p role="status">{progress}</p>}
        {pendingUpload && !busy && <button className={button} onClick={() => void upload([pendingUpload.file])}>重试上传：{pendingUpload.file.name}</button>}
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !draft.title.trim()} onClick={() => void act("save")}>保存草稿</button><button className={button} onClick={() => setPreview(!preview)}>预览</button><button className={`${button} bg-cyan-300 text-slate-950`} disabled={busy || !draft.title.trim()} onClick={() => void act("publish")}>发布到网站</button>{Boolean(draft.published) && <><Link className={button} to={`/journal/${draft.id}`} target="_blank">查看公开页面</Link><button className={button} disabled={busy} onClick={() => { if (window.confirm("确认从公开页面撤下这篇内容？")) void act("unpublish"); }}>撤下</button></>}</div>
        {preview && <article className="space-y-5 border-t border-white/15 pt-7"><h2 className="text-2xl">{draft.title || "未填写标题"}</h2><p className="text-slate-400">{draft.summary}</p><MarkdownRenderer content={draft.body} />{draft.assetIds.map(id => assets.find(a => a.id === id)).filter((a): a is PublishingAsset => Boolean(a)).map(a => a.kind === "image" ? <img key={a.id} className="max-h-[600px] w-full object-contain" src={a.url} alt={a.name} /> : <PublishingVideo key={a.id} src={a.url} name={a.name} />)}</article>}
        </section>
      </div>
    </div>
  </main>;
}
