import { CheckCircle2, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";

import {
  getLatestEnglishAssessment,
  getLatestEnglishSubjectiveAssessment,
  gradeEnglishRetelling,
  gradeEnglishSubjectiveAnswer,
  PrivateAuthApiError,
  type EnglishAssessmentResult,
  type EnglishSubjectiveAssessmentResult,
  type PrivateAuthSession,
} from "@/lib/privateAuth";
import type {
  PrivateLearningAssessment,
  PrivateLearningObjectiveQuestion,
} from "@/lib/privateLearning";
import { getSubjectiveQuestions } from "@/lib/privateLearning";

interface EnglishAssessmentProps {
  assessment?: PrivateLearningAssessment | null;
  episodeId: string;
  session: PrivateAuthSession;
}

interface Draft {
  answers: Record<string, string>;
  subjectiveAnswers: Record<string, string>;
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

function subjectiveStageLabel(type: "comprehension" | "paraphrase" | "application", index: number, total: number): string {
  if (total >= 5) {
    return ["原文支撑", "受控理解", "限定改写", "支持迁移", "有限自由输出"][Math.min(index, 4)];
  }
  return { comprehension: "深层理解", paraphrase: "限定表达改写", application: "场景迁移" }[type];
}

function suggestedWordRange(prompt: string): string | null {
  const match = prompt.match(/\b(?:about\s+)?(\d{1,3})\s*[–—-]\s*(\d{1,3})\s+words?\b/iu);
  return match ? `${match[1]}–${match[2]}` : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof PrivateAuthApiError) {
    if (error.code === "ASSESSMENT_NOT_CONFIGURED") return "AI 批改服务尚未配置，请设置百炼环境变量后再提交。";
    if (error.code === "ASSESSMENT_TIMEOUT") return "本次批改超时，请直接重试；相同提交不会重复生成已完成的结果。";
    if (error.code === "INVALID_RETELLING_LENGTH") return "复述需包含 30–800 个英文单词。";
    if (error.code === "INVALID_SUBJECTIVE_ANSWER_LENGTH") return "本题答案需包含 3–500 个英文单词。";
    if (error.code === "ASSESSMENT_QUESTION_NOT_FOUND") return "本题配置已经变更，请刷新页面后再试。";
    if (error.code === "ASSESSMENT_IN_PROGRESS") return "这次提交仍在批改中，请稍后重试。";
    if (error.code === "ASSESSMENT_DAILY_LIMIT") return "今天的 AI 批改次数已用完，请明天继续。";
  }
  return error instanceof Error ? error.message : "批改失败，请稍后重试。";
}

function Feedback({ result }: { result: EnglishAssessmentResult }): JSX.Element {
  const { grading } = result;
  const normalizedObjectiveScore = result.objective.maxScore
    ? Math.round(result.objective.score / result.objective.maxScore * 30)
    : 0;
  const scores = [
    ["内容", grading.contentScore, 16],
    ["组织", grading.organizationScore, 8],
    ["语法", grading.grammarScore, 8],
    ["表达", grading.expressionScore, 8],
  ] as const;
  return (
    <div className="mt-10 border-t border-emerald-300/20 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.18em] text-emerald-300">AI FEEDBACK</p>
          <h3 className="mt-2 text-xl font-semibold text-white">复述得分 {grading.totalScore} / 40</h3>
        </div>
        {result.objective.maxScore > 0 && (
          <p className="text-sm text-slate-400">复述与客观题 {grading.totalScore + normalizedObjectiveScore} / 70</p>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
        {scores.map(([label, score, max]) => (
          <div className="border-l border-white/10 pl-3 first:border-l-0 first:pl-0 sm:first:border-l" key={label}>
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
          <div className="mt-3 divide-y divide-white/10">
            {grading.languageIssues.map((issue, index) => (
              <div className="py-4 text-sm leading-6 first:pt-0" key={`${index}-${issue.original}`}>
                <p className="text-rose-200 line-through decoration-rose-300/40">{issue.original}</p>
                <p className="mt-1 text-emerald-200">{issue.suggestion}</p>
                <p className="mt-1 text-slate-500">{issue.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <details className="mt-6 border-t border-white/10 pt-5">
        <summary className="cursor-pointer text-sm font-medium text-cyan-200">查看参考改写</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{grading.revisedRetelling}</p>
      </details>
      <p className="mt-4 text-xs text-slate-600">模型 {result.model} · 评分标准 {result.rubricVersion}</p>
      {result.attemptNumber && (
        <p className="mt-2 text-xs text-slate-500">
          第 {result.attemptNumber} 次 · 历史最高 {result.highestScore} / 40
          {result.scoreDelta !== null && result.scoreDelta !== undefined ? ` · 较上次 ${result.scoreDelta >= 0 ? "+" : ""}${result.scoreDelta}` : ""}
        </p>
      )}
    </div>
  );
}

function SubjectiveFeedback({ result }: { result: EnglishSubjectiveAssessmentResult }): JSX.Element {
  const { grading } = result;
  return (
    <div className="mt-5 border-l border-emerald-300/30 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-medium text-emerald-200">{grading.score} / 10</p>
        <p className="text-xs text-slate-500">
          第 {result.attemptNumber} 次 · 最高 {result.highestScore} / 10
          {result.scoreDelta !== null ? ` · 较上次 ${result.scoreDelta >= 0 ? "+" : ""}${result.scoreDelta}` : ""}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{grading.summary}</p>
      {grading.strengths.length > 0 && <p className="mt-3 text-sm leading-6 text-slate-400">做得好：{grading.strengths.join("；")}</p>}
      <p className="mt-2 text-sm leading-6 text-slate-400">改进：{grading.improvements.join("；")}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-cyan-300">查看参考修改</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{grading.revisedAnswer}</p>
      </details>
    </div>
  );
}

export default function EnglishAssessment({ assessment, episodeId, session }: EnglishAssessmentProps): JSX.Element {
  const questions = assessment?.objectiveQuestions ?? [];
  const subjectiveQuestions = useMemo(() => getSubjectiveQuestions(assessment), [assessment]);
  const draftKey = `english-assessment-draft:${session.user.id}:${episodeId}`;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<string, string>>({});
  const [retelling, setRetelling] = useState("");
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [result, setResult] = useState<EnglishAssessmentResult | null>(null);
  const [subjectiveResults, setSubjectiveResults] = useState<Record<string, EnglishSubjectiveAssessmentResult>>({});
  const [subjectiveAttemptIds, setSubjectiveAttemptIds] = useState<Record<string, string>>({});
  const [subjectiveGrading, setSubjectiveGrading] = useState<Record<string, boolean>>({});
  const [subjectiveErrors, setSubjectiveErrors] = useState<Record<string, string>>({});
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wordCount = useMemo(() => retelling.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0, [retelling]);
  const checkedCount = questions.filter((question) => checkedQuestions[question.id]).length;
  const checkedCorrectCount = questions.filter((question) => checkedQuestions[question.id] && isCorrect(question, answers[question.id])).length;
  const completedSubjectiveCount = subjectiveQuestions.filter((question) => subjectiveResults[question.id]).length;
  const objectiveMaxScore = questions.length ? 30 : 0;
  const objectiveAvailableScore = result ? objectiveMaxScore : Math.round(checkedCount / Math.max(1, questions.length) * objectiveMaxScore);
  const objectiveEarnedScore = result && result.objective.maxScore
    ? Math.round(result.objective.score / result.objective.maxScore * objectiveMaxScore)
    : Math.round(checkedCorrectCount / Math.max(1, questions.length) * objectiveMaxScore);
  const subjectiveEarnedScore = Object.values(subjectiveResults).reduce((sum, item) => sum + item.grading.score, 0);
  const availableScore = objectiveAvailableScore + completedSubjectiveCount * 10 + (result ? 40 : 0);
  const earnedScore = objectiveEarnedScore + subjectiveEarnedScore + (result?.grading.totalScore ?? 0);
  const totalScore = objectiveMaxScore + subjectiveQuestions.length * 10 + 40;
  const completedUnits = checkedCount + completedSubjectiveCount + (result ? 1 : 0);
  const totalUnits = questions.length + subjectiveQuestions.length + 1;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved) as Draft;
        if (draft && typeof draft.retelling === "string" && draft.answers && typeof draft.answers === "object") {
          setRetelling(draft.retelling);
          setAnswers(draft.answers);
          if (draft.subjectiveAnswers && typeof draft.subjectiveAnswers === "object") {
            setSubjectiveAnswers(draft.subjectiveAnswers);
          }
        }
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ answers, subjectiveAnswers, retelling } satisfies Draft));
  }, [answers, draftKey, retelling, subjectiveAnswers]);

  useEffect(() => {
    const controller = new AbortController();
    getLatestEnglishAssessment(session, episodeId, controller.signal)
      .then(({ result: latest }) => setResult(latest))
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && loadError instanceof PrivateAuthApiError && loadError.status !== 404) {
          setError(errorMessage(loadError));
        }
      });
    Promise.all(subjectiveQuestions.map(async (question) => {
      const { result: latest } = await getLatestEnglishSubjectiveAssessment(session, episodeId, question.id, controller.signal);
      return [question.id, latest] as const;
    })).then((entries) => {
      if (controller.signal.aborted) return;
      const completed = entries.filter(
        (entry): entry is readonly [string, EnglishSubjectiveAssessmentResult] => Boolean(entry[1]),
      );
      setSubjectiveResults(Object.fromEntries(completed));
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted && loadError instanceof PrivateAuthApiError && loadError.status !== 404) {
        setError(errorMessage(loadError));
      }
    });
    return () => controller.abort();
  }, [episodeId, session, subjectiveQuestions]);

  function setAnswer(questionId: string, value: string): void {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setCheckedQuestions((current) => ({ ...current, [questionId]: false }));
  }

  async function submitSubjective(questionId: string): Promise<void> {
    const answer = subjectiveAnswers[questionId]?.trim() ?? "";
    const answerWords = answer.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
    if (answerWords < 3 || answerWords > 500 || subjectiveGrading[questionId]) return;
    const questionAttemptId = subjectiveAttemptIds[questionId] ?? newAttemptId();
    setSubjectiveAttemptIds((current) => ({ ...current, [questionId]: questionAttemptId }));
    setSubjectiveGrading((current) => ({ ...current, [questionId]: true }));
    setSubjectiveErrors((current) => ({ ...current, [questionId]: "" }));
    try {
      const completed = await gradeEnglishSubjectiveAnswer(session, {
        episodeId,
        questionId,
        attemptId: questionAttemptId,
        answer,
      });
      setSubjectiveResults((current) => ({ ...current, [questionId]: completed }));
      setSubjectiveAttemptIds((current) => ({ ...current, [questionId]: newAttemptId() }));
    } catch (submitError) {
      setSubjectiveErrors((current) => ({ ...current, [questionId]: errorMessage(submitError) }));
    } finally {
      setSubjectiveGrading((current) => ({ ...current, [questionId]: false }));
    }
  }

  async function submitRetelling(): Promise<void> {
    if (wordCount < 30 || wordCount > 800 || grading) return;
    setGrading(true);
    setError(null);
    try {
      const completed = await gradeEnglishRetelling(session, { episodeId, attemptId, retelling, objectiveAnswers: answers });
      setResult(completed);
      setCheckedQuestions(Object.fromEntries(questions.map((question) => [question.id, true])));
      setAttemptId(newAttemptId());
      localStorage.removeItem(draftKey);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setGrading(false);
    }
  }

  function reset(): void {
    setAnswers({});
    setSubjectiveAnswers({});
    setRetelling("");
    setCheckedQuestions({});
    setAttemptId(newAttemptId());
    setResult(null);
    setSubjectiveResults({});
    setSubjectiveAttemptIds({});
    setSubjectiveErrors({});
    setError(null);
    localStorage.removeItem(draftKey);
  }

  return (
    <section className="pt-10">
      <div>
        <div className="border-b border-white/10 pb-7">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-cyan-300" />
            <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">STANDARD PRACTICE</p>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-white">理解与表达训练</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">客观题立即校验；复述提交后由 AI 同步批改并保存。先完成练习，再按需显示下方节目文本。</p>
          <p className="mt-4 text-xs text-slate-500">
            今日进度 {completedUnits} / {totalUnits} · 已获得 {earnedScore} / {availableScore}
            {completedUnits === totalUnits ? ` · 总分 ${earnedScore} / ${totalScore}` : ` · 全部完成后总分 — / ${totalScore}`}
          </p>
        </div>

        {assessment?.targetExpressions.length ? (
          <div className="mt-7">
            <h3 className="text-sm font-medium text-white">本期重点表达</h3>
            <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {assessment.targetExpressions.map((item) => (
                <div className="border-l border-cyan-300/20 pl-4" key={item.expression}>
                  <p className="font-medium text-cyan-100">{item.expression}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.meaning}</p>
                  {item.usage && <p className="mt-2 text-xs leading-5 text-slate-500">{item.usage}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-amber-100/80">本期尚未发布专项客观题，但仍可完成复述并获得 AI 批改。</p>
        )}

        {questions.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium text-white">客观题</h3>
              {checkedCount > 0 && <p className="text-sm text-cyan-200">已校验 {checkedCount} / {questions.length} · 正确 {checkedCorrectCount}</p>}
            </div>
            <div className="mt-3 divide-y divide-white/10">
              {questions.map((question, index) => {
                const correct = isCorrect(question, answers[question.id]);
                return (
                  <fieldset className="py-5 first:pt-2" key={question.id}>
                    <legend className="text-sm font-medium leading-6 text-slate-200">{index + 1}. {question.prompt}</legend>
                    {question.type === "single-choice" ? (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => (
                          <label className="flex cursor-pointer gap-3 py-1.5 text-sm text-slate-300 transition hover:text-cyan-100" key={option.id}>
                            <input checked={answers[question.id] === option.id} className="mt-0.5 accent-cyan-400" name={question.id} onChange={() => setAnswer(question.id, option.id)} type="radio" />
                            <span>{option.text}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input className="mt-3 w-full border-b border-white/15 bg-transparent px-0 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50" onChange={(event) => setAnswer(question.id, event.target.value)} placeholder="Type the missing expression" value={answers[question.id] ?? ""} />
                    )}
                    <button
                      className="mt-4 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!answers[question.id]?.trim()}
                      onClick={() => setCheckedQuestions((current) => ({ ...current, [question.id]: true }))}
                      type="button"
                    >
                      校验本题
                    </button>
                    {checkedQuestions[question.id] && (
                      <div className={`mt-3 flex gap-2 text-sm leading-6 ${correct ? "text-emerald-200" : "text-rose-200"}`}>
                        {correct ? <CheckCircle2 className="mt-1 size-4 shrink-0" /> : <XCircle className="mt-1 size-4 shrink-0" />}
                        <p>{correct ? "回答正确。" : `正确答案：${correctAnswer(question)}。`} <span className="text-slate-400">{question.explanation}</span></p>
                      </div>
                    )}
                  </fieldset>
                );
              })}
            </div>
          </div>
        )}

        {subjectiveQuestions.length > 0 && (
          <div className="mt-9 border-t border-white/10 pt-8">
            <h3 className="text-sm font-medium text-white">AI 短答题</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {subjectiveQuestions.length >= 5
                ? "按原文支撑、理解、改写和迁移逐步增加难度；每题可独立提交并立即批改。"
                : "每题独立提交和保存，完成一题即可立即批改。"}
            </p>
            <div className="mt-4 divide-y divide-white/10">
              {subjectiveQuestions.map((question, index) => {
                const answer = subjectiveAnswers[question.id] ?? "";
                const answerWords = answer.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
                const isSubmitting = Boolean(subjectiveGrading[question.id]);
                const stageLabel = subjectiveStageLabel(question.type, index, subjectiveQuestions.length);
                const wordRange = suggestedWordRange(question.prompt);
                return (
                  <div className="py-6 first:pt-2" key={question.id}>
                    <p className="text-xs text-cyan-300">第 {index + 1} 级 · {stageLabel}</p>
                    <h4 className="mt-2 text-sm font-medium leading-7 text-slate-200">{index + 1}. {question.prompt}</h4>
                    <textarea
                      className="mt-3 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-4 text-[15px] leading-7 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                      onChange={(event) => setSubjectiveAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                      placeholder="Write your answer in English…"
                      value={answer}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <p className={`text-xs ${answerWords > 0 && answerWords < 3 ? "text-amber-300" : "text-slate-500"}`}>
                        {answerWords} words · {wordRange ? `建议 ${wordRange} 词` : "至少 3 词"}
                      </p>
                      <button
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isSubmitting || answerWords < 3 || answerWords > 500}
                        onClick={() => void submitSubjective(question.id)}
                        type="button"
                      >
                        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                        {isSubmitting ? "正在批改…" : `提交第 ${index + 1} 题`}
                      </button>
                    </div>
                    {subjectiveErrors[question.id] && <p className="mt-4 text-sm text-rose-200">{subjectiveErrors[question.id]}</p>}
                    {subjectiveResults[question.id] && <SubjectiveFeedback result={subjectiveResults[question.id]} />}
                  </div>
                );
              })}
            </div>
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
