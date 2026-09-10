import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-100">{children}</a>
  ),
  // Keep externally generated media from making requests while text is revealed.
  img: ({ alt }) => <span>{alt}</span>,
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto" role="region" aria-label="Table" tabIndex={0}>
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
};

/** Shared, HTML-free rendering for both assistant replies, including partial text. */
const AssistantMarkdown = memo(function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 max-w-full text-sm leading-6 text-slate-300 [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-slate-100 [&_h1]:my-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:my-3 [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/40 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre]:text-xs [&_pre]:[overflow-wrap:normal] [&_code]:font-mono [&_code]:text-cyan-100 [&_th]:border [&_th]:border-white/15 [&_th]:bg-white/5 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-white/15 [&_td]:px-3 [&_td]:py-2 [&_hr]:my-4 [&_hr]:border-white/10">
      <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default AssistantMarkdown;
