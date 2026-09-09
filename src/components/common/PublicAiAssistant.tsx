import { Bot, Send, Square, Trash2, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type KeyboardEvent,
} from "react";

import {
  PublicAssistantApiError,
  askPublicAssistant,
} from "@/lib/publicAssistant";

interface Props {
  pagePath: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const QUESTION_MAX_LENGTH = 140;
const DISCLAIMER = "内容均由人工智能模型生成，准确性和完整性无法保证，这不代表yanxiao.me的态度或观点";

const assistantCss = `
@keyframes public-ai-dot {
  0%, 60%, 100% { opacity: .28; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

.public-ai-dot {
  animation: public-ai-dot 1.05s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .public-ai-dot { animation: none; opacity: .7; }
}
`;

function messageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof PublicAssistantApiError) {
    if (error.code === "PUBLIC_ASSISTANT_TIMEOUT") return "回答超时，请再试一次。";
    if (error.code === "INVALID_PUBLIC_ASSISTANT_REQUEST") return "问题需控制在 140 个字符以内。";
    if (error.code === "PUBLIC_ASSISTANT_PAGE_NOT_FOUND") return "暂时无法读取当前页面内容。";
  }
  return "AI 问答暂时不可用，请稍后再试。";
}

function waitForReveal(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(finish, 18);
    const abort = () => finish(new DOMException("Aborted", "AbortError"));
    function finish(error?: DOMException): void {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

export default function PublicAiAssistant({ pagePath }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setError(null);
    setSending(false);
  }, [pagePath]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || question.length > QUESTION_MAX_LENGTH || sending) return;

    const userMessage: ChatMessage = { id: messageId(), role: "user", content: question };
    const assistantId = messageId();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const { answer } = await askPublicAssistant({ pagePath, question }, controller.signal);
      const characters = Array.from(answer);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const chunkSize = reduceMotion ? characters.length : Math.max(1, Math.ceil(characters.length / 180));
      for (let index = 0; index < characters.length; index += chunkSize) {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const delta = characters.slice(index, index + chunkSize).join("");
        setMessages((current) => current.map((message) => (
          message.id === assistantId ? { ...message, content: message.content + delta } : message
        )));
        if (index + chunkSize < characters.length) await waitForReveal(controller.signal);
      }
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId || message.content.trim()));
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError(errorMessage(requestError));
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
          aria-label="当前页面 AI 问答"
          className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[120] flex max-h-[min(72dvh,620px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101b]/[0.98] shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[400px]"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Bot className="size-4 text-cyan-300" />问问 AI</h2>
              <p className="mt-1 text-xs text-slate-500">只回答当前页面；每次提问相互独立</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.some((message) => message.content) && !sending && (
                <button
                  aria-label="清空本页问答"
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
              <p className="py-7 text-center text-slate-500">可以问我当前页面里的概念、术语或上下文。</p>
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
                        className="public-ai-dot size-1.5 rounded-full bg-cyan-300"
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
                maxLength={QUESTION_MAX_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问问当前页面…"
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
            <div className="mt-2 flex items-start justify-between gap-3 px-1 text-[10px] leading-4 text-slate-600">
              <p>{DISCLAIMER}</p>
              <span className="shrink-0 font-mono">{draft.length}/{QUESTION_MAX_LENGTH}</span>
            </div>
          </form>
        </aside>
      ) : (
        <button
          aria-label="打开当前页面 AI 问答"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[120] inline-flex h-12 items-center gap-2 rounded-full border border-cyan-300/20 bg-[#0b101b]/95 px-4 text-sm font-medium text-cyan-200 shadow-xl shadow-black/40 backdrop-blur-xl transition hover:border-cyan-300/40 hover:bg-[#111a29] sm:right-6"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Bot className="size-4" />问问 AI
        </button>
      )}
    </>
  );
}
