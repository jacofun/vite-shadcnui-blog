import { lazy, Suspense } from "react";

const AssistantMarkdown = lazy(() => import("./AssistantMarkdown"));

export default function AssistantMessage({ content }: { content: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap text-slate-300 [overflow-wrap:anywhere]">{content}</p>}>
      <AssistantMarkdown content={content} />
    </Suspense>
  );
}
