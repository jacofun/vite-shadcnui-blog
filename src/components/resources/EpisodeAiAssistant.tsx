import { MessageCircle, Send, Square, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type JSX, type KeyboardEvent } from "react";

import {
  PrivateAuthApiError,
  streamEnglishAssistant,
  type EnglishAssistantHistoryMessage,
  type PrivateAuthSession,
} from "@/lib/privateAuth";

interface Props {
  episodeId: string;
  session: PrivateAuthSession;
}

interface ChatMessage extends EnglishAssistantHistoryMessage {
  id: string;
}

const assistantCss = `
@keyframes episode-ai-dot {
  0%, 60%, 100% { opacity: .28; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

.episode-ai-dot {
  animation: episode-ai-dot 1.05s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .episode-ai-dot { animation: none; opacity: .7; }
}
`;

function messageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function readSavedMessages(key: string): ChatMessage[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): ChatMessage[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<ChatMessage>;
      if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") return [];
      const content = candidate.content.trim();
      return content ? [{ id: typeof candidate.id === "string" ? candidate.id : messageId(), role: candidate.role, content }] : [];
    }).slice(-30);
  } catch {
    return [];
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof PrivateAuthApiError) {
    if (error.code === "ASSISTANT_TIMEOUT") return "回答超时，请再试一次。";
    if (error.code === "ASSESSMENT_MODEL_ERROR") return "AI 服务暂时不可用，请稍后再试。";
    return error.message;
  }
  return "AI 问答暂时不可用，请稍后再试。";
}

export default function EpisodeAiAssistant({ episodeId, session }: Props): JSX.Element {
  const storageKey = useMemo(() => `episode-ai:${session.user.id}:${episodeId}`, [episodeId, session.user.id]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readSavedMessages(storageKey));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(readSavedMessages(storageKey));
    setDraft("");
    setError(null);
  }, [storageKey]);

  useEffect(() => {
    const saved = messages.filter((message) => message.content.trim()).slice(-30);
    localStorage.setItem(storageKey, JSON.stringify(saved));
  }, [messages, storageKey]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;

    const userMessage: ChatMessage = { id: messageId(), role: "user", content: question };
    const assistantId = messageId();
    const history = messages
      .filter((message) => message.content.trim())
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      await streamEnglishAssistant(
        session,
        { episodeId, question, history },
        (delta) => setMessages((current) => current.map((message) => (
          message.id === assistantId ? { ...message, content: message.content + delta } : message
        ))),
        controller.signal,
      );
    } catch (streamError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId || message.content.trim()));
      if (!(streamError instanceof DOMException && streamError.name === "AbortError")) {
        setError(errorMessage(streamError));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const waitingForFirstText = sending && messages.at(-1)?.role === "assistant" && !messages.at(-1)?.content;

  return (
    <>
      <style>{assistantCss}</style>
      {open ? (
        <aside
          aria-label="本期节目 AI 问答"
          className="fixed inset-x-3 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-[110] flex max-h-[min(60dvh,560px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101b]/[0.98] shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[390px]"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-white">本期问答</h2>
              <p className="mt-0.5 text-xs text-slate-500">单词、短语、句子和原文联系</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.some((message) => message.content) && !sending && (
                <button
                  aria-label="清空问答记录"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                  onClick={() => { setMessages([]); setError(null); }}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
              <button
                aria-label="关闭 AI 问答"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-6">
            {messages.length === 0 && (
              <p className="py-6 text-center text-slate-500">可以问我本期节目中的单词、短语和句子。</p>
            )}
            {messages.map((message) => (
              <div className={message.role === "user" ? "ml-8 flex justify-end" : "mr-5"} key={message.id}>
                {message.role === "user" ? (
                  <p className="max-w-full whitespace-pre-wrap rounded-2xl rounded-br-md bg-cyan-300/[0.12] px-3.5 py-2.5 text-slate-200">{message.content}</p>
                ) : message.content ? (
                  <p className="whitespace-pre-wrap text-slate-300">{message.content}</p>
                ) : waitingForFirstText ? (
                  <div aria-label="等待回答" className="flex h-6 items-center gap-1">
                    {[0, 1, 2].map((index) => (
                      <span
                        className="episode-ai-dot size-1.5 rounded-full bg-cyan-300"
                        key={index}
                        style={{ animationDelay: `${index * 140}ms` }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form className="border-t border-white/10 p-3" onSubmit={(event) => void submit(event)}>
            {error && <p className="mb-2 px-1 text-xs text-rose-300">{error}</p>}
            <div className="flex items-end gap-2 rounded-xl bg-white/[0.055] p-2 pl-3">
              <textarea
                aria-label="向 AI 提问"
                className="max-h-24 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-200 outline-none placeholder:text-slate-600"
                disabled={sending}
                maxLength={500}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问一个单词、短语或句子…"
                rows={1}
                value={draft}
              />
              {sending ? (
                <button
                  aria-label="停止生成"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-slate-300 transition hover:bg-white/15"
                  onClick={() => abortRef.current?.abort()}
                  type="button"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  aria-label="发送问题"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                  disabled={!draft.trim()}
                  type="submit"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
          </form>
        </aside>
      ) : (
        <button
          aria-label="打开本期节目 AI 问答"
          className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-4 z-[110] inline-flex h-12 items-center gap-2 rounded-full border border-cyan-300/20 bg-[#0b101b]/95 px-4 text-sm font-medium text-cyan-200 shadow-xl shadow-black/40 backdrop-blur-xl transition hover:border-cyan-300/40 hover:bg-[#111a29] sm:right-6"
          onClick={() => setOpen(true)}
          type="button"
        >
          <MessageCircle className="size-4" />AI 问答
        </button>
      )}
    </>
  );
}
