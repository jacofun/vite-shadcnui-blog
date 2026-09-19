import { Bot, Check, Copy, RotateCcw, Send, Square, Trash2, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  PublicAssistantApiError,
  askPublicAssistant,
} from "@/lib/publicAssistant";
import AssistantMessage from "@/components/common/AssistantMessage";

interface Props {
  pagePath: string;
  launcher?: (controls: AssistantLauncherControls) => ReactNode;
}

export interface AssistantLauncherControls {
  ask: (question: string) => void;
  open: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type WaitingStage = "reading" | "organizing" | "generating";

const QUESTION_MAX_LENGTH = 140;
const DISCLAIMER = "内容均由人工智能模型生成，准确性和完整性无法保证，这不代表yanxiao.me的态度或观点";

function suggestedQuestions(pagePath: string): string[] {
  if (pagePath === "/notes") {
    return ["推荐三篇值得先读的笔记", "找出与 AI 有关的内容", "按主题介绍全部笔记"];
  }
  if (pagePath.startsWith("/notes/")) {
    return ["总结当前文章", "提取核心观点", "列出关键数据和结论"];
  }
  if (pagePath === "/wedding") {
    return ["介绍这个页面", "婚礼在什么时间和地点？", "概括页面中的故事"];
  }
  return ["最近更新了什么？", "网站主要关注哪些主题？", "推荐一篇笔记"];
}

function waitingText(stage: WaitingStage): string {
  if (stage === "reading") return "正在读取当前页面";
  if (stage === "organizing") return "正在组织回答";
  return "正在生成内容";
}

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

export default function PublicAiAssistant({ pagePath, launcher }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingStage, setWaitingStage] = useState<WaitingStage>("reading");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
    setMessages([]);
    setDraft("");
    setError(null);
    setSending(false);
    setWaitingStage("reading");
    setCopiedMessageId(null);
  }, [pagePath]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (stageTimerRef.current !== null) window.clearTimeout(stageTimerRef.current);
  }, []);

  async function sendQuestion(value: string): Promise<void> {
    const question = value.trim();
    if (!question || question.length > QUESTION_MAX_LENGTH || sending) return;

    const userMessage: ChatMessage = { id: messageId(), role: "user", content: question };
    const assistantId = messageId();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setSending(true);
    setWaitingStage("reading");
    if (stageTimerRef.current !== null) window.clearTimeout(stageTimerRef.current);
    stageTimerRef.current = window.setTimeout(() => setWaitingStage("organizing"), 700);

    try {
      await askPublicAssistant({ pagePath, question }, (delta) => {
        if (stageTimerRef.current !== null) {
          window.clearTimeout(stageTimerRef.current);
          stageTimerRef.current = null;
        }
        setWaitingStage("generating");
        setMessages((current) => current.map((message) => (
          message.id === assistantId ? { ...message, content: message.content + delta } : message
        )));
      }, controller.signal);
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== assistantId || message.content.trim()));
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError(errorMessage(requestError));
      }
    } finally {
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
        stageTimerRef.current = null;
      }
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }

  async function submit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    await sendQuestion(draft);
  }

  function openAssistant(): void {
    setOpen(true);
  }

  function askFromLauncher(question: string): void {
    setOpen(true);
    void sendQuestion(question);
  }

  async function copyAnswer(message: ChatMessage): Promise<void> {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1600);
  }

  function retryLastQuestion(): void {
    const question = [...messages].reverse().find((message) => message.role === "user")?.content;
    if (question) void sendQuestion(question);
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
      {launcher?.({ ask: askFromLauncher, open: openAssistant })}
      {open ? (
        <aside
          aria-label="当前页面 AI 问答"
          className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[120] flex max-h-[min(72dvh,620px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b101b]/[0.98] shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[400px]"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Bot className="size-4 text-cyan-300" />AI 阅读助手</h2>
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
              <div className="py-3">
                <p className="text-sm text-slate-400">可以直接提问，也可以从下面开始：</p>
                <div className="mt-3 grid gap-2">
                  {suggestedQuestions(pagePath).map((question) => (
                    <button
                      className="rounded-xl border border-white/10 bg-white/[0.025] px-3.5 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.055] hover:text-cyan-100"
                      key={question}
                      onClick={() => void sendQuestion(question)}
                      type="button"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div className={message.role === "user" ? "ml-8 flex justify-end" : "mr-5"} key={message.id}>
                {message.role === "user" ? (
                  <p className="max-w-full whitespace-pre-wrap rounded-2xl rounded-br-md bg-cyan-300/[0.12] px-3.5 py-2.5 text-slate-200">{message.content}</p>
                ) : message.content ? (
                  <div className="min-w-0">
                    <AssistantMessage content={message.content} />
                    {sending && message.id === messages.at(-1)?.id && (
                      <p className="mt-2 text-[11px] text-slate-600">{waitingText(waitingStage)}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1 text-slate-600">
                      <button
                        aria-label="复制回答"
                        className="rounded-md p-1.5 transition hover:bg-white/[0.06] hover:text-slate-300"
                        onClick={() => void copyAnswer(message)}
                        type="button"
                      >
                        {copiedMessageId === message.id ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                ) : waitingForFirstText ? (
                  <div aria-label={waitingText(waitingStage)} className="flex h-6 items-center gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((index) => (
                        <span
                          className="public-ai-dot size-1.5 rounded-full bg-cyan-300"
                          key={index}
                          style={{ animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </div>
                    <span>{waitingText(waitingStage)}</span>
                  </div>
                ) : null}
              </div>
            ))}
            {!sending && messages.some((message) => message.role === "assistant" && message.content) && (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-300"
                onClick={retryLastQuestion}
                type="button"
              >
                <RotateCcw className="size-3.5" />重新生成
              </button>
            )}
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
                placeholder={pagePath === "/notes" ? "描述你想找的内容…" : "问问当前页面…"}
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
      ) : !launcher ? (
        <button
          aria-label="打开 AI 阅读助手"
          className="ai-orbit-border fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[120] inline-flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-cyan-200 backdrop-blur-xl sm:right-6"
          onClick={openAssistant}
          type="button"
        >
          <Bot className="size-4" />问 AI
        </button>
      ) : null}
    </>
  );
}
