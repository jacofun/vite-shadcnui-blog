import { ArrowLeft, CheckCircle2, FileAudio, FileText, RefreshCw, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import {
  beginPrivateResourceUpload,
  completePrivateResourceUpload,
  type PrivateResourceUploadRequest,
} from "@/lib/privateAuth";
import { uploadPrivateResourceFile } from "@/lib/privateResourceUpload";
import {
  loadPrivateResourceCatalog,
  type PrivateResourceCollection,
} from "@/lib/privateResources";

const fieldClass = "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10";
const today = new Date().toISOString().slice(0, 10);

function FileField({
  accept,
  file,
  icon: Icon,
  label,
  onChange,
  required = false,
}: {
  accept: string;
  file: File | null;
  icon: typeof FileAudio;
  label: string;
  onChange: (file: File | null) => void;
  required?: boolean;
}): JSX.Element {
  return (
    <label className="block rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-4 transition hover:border-cyan-300/30">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <Icon className="size-4 text-cyan-300" />{label}{required && <span className="text-rose-300">*</span>}
      </span>
      <input
        accept={accept}
        className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/10 file:px-3 file:py-2 file:text-xs file:text-cyan-200"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        required={required}
        type="file"
      />
      {file && <span className="mt-2 block truncate text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span>}
    </label>
  );
}

export default function PrivateResourceUpload(): JSX.Element {
  const access = usePrivateResourceSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [collections, setCollections] = useState<PrivateResourceCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [itemId, setItemId] = useState("");
  const [title, setTitle] = useState("");
  const [publishedAt, setPublishedAt] = useState(today);
  const [recommendedDate, setRecommendedDate] = useState(today);
  const [sourcePage, setSourcePage] = useState("");
  const [reason, setReason] = useState("");
  const [difficulty, setDifficulty] = useState("B1-B2");
  const [tags, setTags] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState<File | null>(null);
  const [transcriptPdf, setTranscriptPdf] = useState<File | null>(null);
  const [genericFiles, setGenericFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "publishing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const canWrite = access.session?.user.role === "owner" ||
    access.session?.user.permissions.includes("private-resources-write");

  useEffect(() => {
    if (access.status !== "ready" || !access.session) return;
    const controller = new AbortController();
    loadPrivateResourceCatalog(access.session, controller.signal)
      .then((catalog) => {
        const supported = catalog.collections.filter((collection) => ["audio-transcript", "files"].includes(collection.type));
        setCollections(supported);
        const requested = searchParams.get("collection");
        setCollectionId((current) => current || supported.find((item) => item.collectionId === requested)?.collectionId || supported[0]?.collectionId || "");
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "资源合集读取失败");
        }
      });
    return () => controller.abort();
  }, [access.session, access.status, searchParams]);

  const selectedCollection = collections.find((collection) => collection.collectionId === collectionId);

  const submitLabel = useMemo(() => {
    if (status === "uploading") return `正在上传 ${progress}%`;
    if (status === "publishing") return "正在发布资源";
    if (status === "done") return "发布完成";
    return "上传并发布";
  }, [progress, status]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!access.session || !collectionId) return;
    setError(null);
    setProgress(0);
    setStatus("uploading");
    try {
      if (selectedCollection?.type === "files") {
        if (genericFiles.length === 0) throw new Error("请至少选择一个文件");
        for (let index = 0; index < genericFiles.length; index += 1) {
          const file = genericFiles[index];
          const upload = await beginPrivateResourceUpload(access.session, {
            collectionId,
            file: { originalName: file.name, bytes: file.size },
          });
          const target = upload.files.file;
          if (!target) throw new Error("上传服务未返回 OSS 地址");
          await uploadPrivateResourceFile(file, target, ({ loaded }) => {
            const completed = index / genericFiles.length;
            const current = (loaded / Math.max(file.size, 1)) / genericFiles.length;
            setProgress(Math.min(100, Math.round((completed + current) * 100)));
          });
          setStatus("publishing");
          await completePrivateResourceUpload(access.session, upload.uploadToken);
          if (index < genericFiles.length - 1) setStatus("uploading");
        }
        setStatus("done");
        window.setTimeout(() => navigate(`/resources/${collectionId}`), 600);
        return;
      }
      if (!audio || !transcriptText) throw new Error("请选择 MP3 音频和 TXT 文稿");
      const request: PrivateResourceUploadRequest = {
        collectionId,
        ...(itemId.trim() ? { itemId: itemId.trim() } : {}),
        title: title.trim(),
        publishedAt,
        recommendedDate,
        ...(sourcePage.trim() ? { sourcePage: sourcePage.trim() } : {}),
        reason: reason.trim(),
        difficulty: difficulty.trim(),
        tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        files: {
          audio: { contentType: "audio/mpeg", bytes: audio.size },
          transcriptText: { contentType: "text/plain", bytes: transcriptText.size },
          ...(transcriptPdf ? {
            transcriptPdf: { contentType: "application/pdf" as const, bytes: transcriptPdf.size },
          } : {}),
        },
      };
      const upload = await beginPrivateResourceUpload(access.session, request);
      const localFiles: Record<string, File> = {
        audio,
        transcriptText,
        ...(transcriptPdf ? { transcriptPdf } : {}),
      };
      const uploaded = new Map<string, number>();
      const total = Object.values(localFiles).reduce((sum, file) => sum + file.size, 0);
      await Promise.all(Object.entries(localFiles).map(async ([role, file]) => {
        const target = upload.files[role];
        if (!target) throw new Error(`上传服务未返回 ${role} 的 OSS 地址`);
        await uploadPrivateResourceFile(file, target, ({ loaded }) => {
          uploaded.set(role, loaded);
          const loadedTotal = [...uploaded.values()].reduce((sum, value) => sum + value, 0);
          setProgress(Math.min(100, Math.round((loadedTotal / total) * 100)));
        });
      }));
      setStatus("publishing");
      const published = await completePrivateResourceUpload(access.session, upload.uploadToken);
      setStatus("done");
      window.setTimeout(() => navigate(`/resources/${published.collectionId}/${published.itemId}`), 600);
    } catch (uploadError) {
      setStatus("idle");
      setError(uploadError instanceof Error ? uploadError.message : "资源上传失败");
    }
  }

  if (access.status !== "ready") {
    return <PrivateResourceAccessState error={access.error} status={access.status} />;
  }

  return (
    <>
      <Helmet>
        <title>上传私人资源 · 彦骁的笔记</title>
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>
      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/resources">
            <ArrowLeft className="size-4" />返回私人资源
          </Link>
          <header className="mt-8">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">PRIVATE UPLOAD</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">上传资源</h1>
            <p className="mt-5 text-sm leading-7 text-slate-400">文件将直接上传至私人 OSS，全部核验完成后才会写入合集索引。</p>
          </header>

          {!canWrite && (
            <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm text-amber-100">当前账户没有私人资源写入权限。</div>
          )}

          {canWrite && (
            <form className="mt-10 space-y-8" onSubmit={submit}>
              <section className="grid gap-5 rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:grid-cols-2 sm:p-7">
                <label className="text-sm text-slate-400">所属合集
                  <select className={fieldClass} onChange={(event) => setCollectionId(event.target.value)} required value={collectionId}>
                    {collections.map((collection) => <option className="bg-slate-950" key={collection.collectionId} value={collection.collectionId}>{collection.title}</option>)}
                  </select>
                </label>
                {selectedCollection?.type === "audio-transcript" && <label className="text-sm text-slate-400">资源 ID（可留空自动生成）
                  <input className={fieldClass} maxLength={100} onChange={(event) => setItemId(event.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,99}" placeholder="例如 debt-and-money" value={itemId} />
                </label>}
                {selectedCollection?.type === "audio-transcript" && <><label className="text-sm text-slate-400 sm:col-span-2">标题
                  <input className={fieldClass} maxLength={200} onChange={(event) => setTitle(event.target.value)} required value={title} />
                </label>
                <label className="text-sm text-slate-400">发布日期
                  <input className={fieldClass} onChange={(event) => setPublishedAt(event.target.value)} required type="date" value={publishedAt} />
                </label>
                <label className="text-sm text-slate-400">推荐日期
                  <input className={fieldClass} onChange={(event) => setRecommendedDate(event.target.value)} required type="date" value={recommendedDate} />
                </label>
                <label className="text-sm text-slate-400">难度
                  <input className={fieldClass} maxLength={20} onChange={(event) => setDifficulty(event.target.value)} required value={difficulty} />
                </label>
                <label className="text-sm text-slate-400">标签（逗号分隔）
                  <input className={fieldClass} onChange={(event) => setTags(event.target.value)} placeholder="英语学习, 精听" value={tags} />
                </label>
                <label className="text-sm text-slate-400 sm:col-span-2">来源页面（可选）
                  <input className={fieldClass} onChange={(event) => setSourcePage(event.target.value)} placeholder="https://..." type="url" value={sourcePage} />
                </label>
                <label className="text-sm text-slate-400 sm:col-span-2">资源说明
                  <textarea className={`${fieldClass} min-h-28 resize-y`} maxLength={1000} onChange={(event) => setReason(event.target.value)} required value={reason} />
                </label></>}
              </section>

              {selectedCollection?.type === "files" ? (
                <label className="block rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 transition hover:border-cyan-300/30">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-200"><UploadCloud className="size-4 text-cyan-300" />选择文件（可多选）</span>
                  <input className="mt-4 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300/10 file:px-3 file:py-2 file:text-xs file:text-cyan-200" multiple onChange={(event) => setGenericFiles(Array.from(event.target.files || []))} required type="file" />
                  {genericFiles.length > 0 && <span className="mt-3 block text-xs text-slate-500">已选择 {genericFiles.length} 个文件；MP3、MP4、FLV 可在线播放，单文件最大 1 GB。</span>}
                </label>
              ) : <section className="grid gap-4 sm:grid-cols-2">
                <FileField accept="audio/mpeg,.mp3" file={audio} icon={FileAudio} label="MP3 音频" onChange={setAudio} required />
                <FileField accept="text/plain,.txt" file={transcriptText} icon={FileText} label="TXT 文稿" onChange={setTranscriptText} required />
                <div className="sm:col-span-2"><FileField accept="application/pdf,.pdf" file={transcriptPdf} icon={FileText} label="PDF 原稿（可选）" onChange={setTranscriptPdf} /></div>
              </section>}

              {error && <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</div>}
              {status !== "idle" && (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width]" style={{ width: `${status === "publishing" || status === "done" ? 100 : progress}%` }} />
                </div>
              )}
              <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={status !== "idle" || collections.length === 0} type="submit">
                {status === "done" ? <CheckCircle2 className="size-4" /> : status !== "idle" ? <RefreshCw className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {submitLabel}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
