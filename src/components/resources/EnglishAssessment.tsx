import { CheckCircle2, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";

import {
  getLatestEnglishAssessment,
  gradeEnglishRetelling,
  PrivateAuthApiError,
  type EnglishAssessmentResult,
  type PrivateAuthSession,
} from "@/lib/privateAuth";
import type {
  PrivateLearningAssessment,
  PrivateLearningObjectiveQuestion,
} from "@/lib/privateLearning";

interface EnglishAssessmentProps {
  assessment?: PrivateLearningAssessment | null;
  episodeId: string;
  session: PrivateAuthSession;
}

interface Draft {
  answers: Record<string, string>;
  retelling: string;
}

function newAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeAnswer(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US")
    .replace(/[.!?]+$/u, "").replace(/[’‘]/gu, "'").replace(/\s+/gu, " ");
}

function isCorrect(question: PrivateLearningObjectiveQuestion, answer = ""): boolean {
  return question.type === "single-choice"
    ? answer === question.answer
    : question.answers.some((expected) => normalizeAnswer(expected) === normalizeAnswer(answer));
}

function correctAnswer(question: PrivateLearningObjectiveQuestion): string {
  if (question.type === "fill-blank") return question.answers[0];
  return question.options.find((option) => option.id === question.answer)?.text ?? question.answer;
}

function errorMessage(error: unknown): string {
  if (error instanceof PrivateAuthApiError) {
    if (error.code === "ASSESSMENT_NOT_CONFIGURED") return "AI 批改服务尚未配置，请设置百炼环境变量后再提交。";
    if (error.code === "ASSESSMENT_TIMEOUT") return "本次批改超时，请直接重试；相同提交不会重复生成已完成的结果。";
    if (error.code === "INVALID_RETELLING_LENGTH") return "复述需包含 30–800 个英文单词。";
    if (error.code === "ASSESSMENT_IN_PROGRESS") return "这次提交仍在批改中，请稍后重试。";
    if (error.code === "ASSESSMENT_DAILY_LIMIT") return "今天的 AI 批改次数已用完，请明天继续。";
  }
  return error instanceof Error ? error.message : "批改失败，请稍后重试。";
}

function Feedback({ result }: { result: EnglishAssessmentResult }): JSX.Element {
  const { grading } = result;
  const scores = [
    ["内容", grading.contentScore, 16],
    ["组织", grading.organizationScore, 8],
    ["语法", grading.grammarScore, 8],
    ["表达", grading.expressionScore, 8],
  ] as const;
  return (
    <div className="mt-8 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-emerald-300">AI FEEDBACK</p>
          <h3 className="mt-2 text-xl font-semibold text-white">复述得分 {grading.totalScore} / 40</h3>
        </div>
        {result.objective.maxScore > 0 && (
          <p className="text-sm text-slate-400">综合 {grading.totalScore + result.objective.score} / 100</p>
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {scores.map(([label, score, max]) => (
          <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-3" key={label}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{score}<span className="text-xs font-normal text-slate-500"> / {max}</span></p>
          </div>
        ))}
      </div>
      <p className="mt-5 leading-7 text-slate-200">{grading.summary}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-medium text-white">优先改进</h4>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {grading.priorityImprovements.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
          </ol>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">内容与目标表达</h4>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {[...grading.contentFeedback, ...grading.targetExpressionFeedback].map((item) => <li key={item}>· {item}</li>)}
          </ul>
        </div>
      </div>
      {grading.languageIssues.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-white">语言修正</h4>
          <div className="mt-3 space-y-3">
            {grading.languageIssues.map((issue, index) => (
              <div className="rounded-xl border border-white/10 bg-black/15 p-4 text-sm leading-6" key={`${index}-${issue.original}`}>
                <p className="text-rose-200 line-through decoration-rose-300/40">{issue.original}</p>
                <p className="mt-1 text-emerald-200">{issue.suggestion}</p>
                <p className="mt-1 text-slate-500">{issue.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <details className="mt-6 rounded-xl border border-white/10 bg-black/15 p-4">
        <summary className="cursor-pointer text-sm font-medium text-cyan-200">查看参考改写</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{grading.revisedRetelling}</p>
      </details>
      <p className="mt-4 text-xs text-slate-600">模型 {result.model} · 评分标准 {result.rubricVersion}</p>
    </div>
  );
}

export default function EnglishAssessment({ assessment, episodeId, session }: EnglishAssessmentProps): JSX.Element {
  const questions = assessment?.objectiveQuestions ?? [];
  const draftKey = `english-assessment-draft:${session.user.id}:${episodeId}`;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [retelling, setRetelling] = useState("");
  const [checked, setChecked] = useState(false);
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [result, setResult] = useState<EnglishAssessmentResult | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wordCount = useMemo(() => retelling.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0, [retelling]);
  const correctCount = questions.filter((question) => isCorrect(question, answers[question.id])).length;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Draft;
        if (draft && typeof draft.retelling === "string" && draft.answers && typeof draft.answers === "object") {
          setRetelling(draft.retelling);
          setAnswers(draft.answers);
        }
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ answers, retelling } satisfies Draft));
  }, [answers, draftKey, retelling]);

  useEffect(() => {
    const controller = new AbortController();
    getLatestEnglishAssessment(session, episodeId, controller.signal)
      .then(({ result: latest }) => setResult(latest))
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && loadError instanceof PrivateAuthApiError && loadError.status !== 404) {
          setError(errorMessage(loadError));
        }
      });
    return () => controller.abort();
  }, [episodeId, session]);

  function setAnswer(questionId: string, value: string): void {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setChecked(false);
  }

  async function submitRetelling(): Promise<void> {
    if (wordCount < 30 || wordCount > 800 || grading) return;
    setGrading(true);
    setError(null);
    try {
      const completed = await gradeEnglishRetelling(session, { episodeId, attemptId, retelling, objectiveAnswers: answers });
      setResult(completed);
      setChecked(true);
      localStorage.removeItem(draftKey);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setGrading(false);
    }
  }

  function reset(): void {
    setAnswers({});
    setRetelling("");
    setChecked(false);
    setAttemptId(newAttemptId());
    setResult(null);
    setError(null);
    localStorage.removeItem(draftKey);
  }

  return (
    <section className="pt-10">
      <div className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.07] to-violet-300/[0.04] p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 size-5 shrink-0 text-cyan-300" />
          <div>
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">STANDARD PRACTICE</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">理解与表达训练</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">客观题立即校验；复述提交后由 AI 同步批改并保存。先完成练习，再按需展开下方节目文本。</p>
          </div>
        </div>

        {assessment?.targetExpressions.length ? (
          <div className="mt-7">
            <h3 className="text-sm font-medium text-white">本期重点表达</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {assessment.targetExpressions.map((item) => (
                <div className="rounded-xl border border-white/10 bg-black/15 p-4" key={item.expression}>
                  <p className="font-medium text-cyan-100">{item.expression}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.meaning}</p>
                  {item.usage && <p className="mt-2 text-xs leading-5 text-slate-500">{item.usage}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm text-amber-100/80">本期尚未发布专项客观题，但仍可完成复述并获得 AI 批改。</p>
        )}

        {questions.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium text-white">客观题</h3>
              {checked && <p className="text-sm text-cyan-200">{correctCount} / {questions.length} 正确</p>}
            </div>
            <div className="mt-3 space-y-4">
              {questions.map((question, index) => {
                const correct = isCorrect(question, answers[question.id]);
                return (
                  <fieldset className="rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5" key={question.id}>
                    <legend className="px-1 text-sm font-medium leading-6 text-slate-200">{index + 1}. {question.prompt}</legend>
                    {question.type === "single-choice" ? (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => (
                          <label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-slate-300 hover:border-cyan-300/30" key={option.id}>
                            <input checked={answers[question.id] === option.id} className="mt-0.5 accent-cyan-400" name={question.id} onChange={() => setAnswer(question.id, option.id)} type="radio" />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" onChange={(event) => setAnswer(question.id, event.target.value)} placeholder="Type the missing expression" value={answers[question.id] ?? ""} />
                    )}
                    {checked && (
                      <div className={`mt-3 flex gap-2 text-sm leading-6 ${correct ? "text-emerald-200" : "text-rose-200"}`}>
                        {correct ? <CheckCircle2 className="mt-1 size-4 shrink-0" /> : <XCircle className="mt-1 size-4 shrink-0" />}
                        <p>{correct ? "回答正确。" : `正确答案：${correctAnswer(question)}。`} <span className="text-slate-400">{question.explanation}</span></p>
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
            <button className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13]" onClick={() => setChecked(true)} type="button">校验客观题</button>
          </div>
        )}

        <div className="mt-9 border-t border-white/10 pt-8">
          <h3 className="text-sm font-medium text-white">英文复述</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{assessment?.retellingPrompt ?? "不看原文，用自己的英语复述本期核心内容，并尽量使用自然、可复用的表达。"}</p>
          <textarea className="mt-4 min-h-56 w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-[15px] leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" onChange={(event) => setRetelling(event.target.value)} placeholder="Write your retelling here (recommended: 80–150 words)…" value={retelling} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${wordCount > 0 && wordCount < 30 ? "text-amber-300" : "text-slate-500"}`}>{wordCount} words · 至少 30 词</p>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-white/20" onClick={reset} type="button"><RotateCcw className="size-4" />新一轮</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40" disabled={grading || wordCount < 30 || wordCount > 800} onClick={() => void submitRetelling()} type="button">
                {grading && <Loader2 className="size-4 animate-spin" />}{grading ? "正在批改…" : "提交并即时批改"}
              </button>
            </div>
          </div>
          {error && <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{error}</p>}
          {result && <Feedback result={result} />}
        </div>
      </div>
    </section>
  );
}
