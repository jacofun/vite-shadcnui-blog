import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Bot, MoreHorizontal, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import PublicAiAssistant from "@/components/common/PublicAiAssistant";
import { siteHome } from "@/config/config";
import type { HomeContent } from "@/lib/homeContent";

export default function HomeNavigation({ items }: { items: HomeContent[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const normalized = query.trim().toLowerCase();
  const results = normalized
    ? items.filter((item) => item.searchText.includes(normalized)).slice(0, 6)
    : items.slice(0, 4);

  useEffect(() => {
    if (!more) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMore(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMore(false);
        moreButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [more]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (results[0]) {
      setOpen(false);
      navigate(results[0].href);
    }
  }

  return (
    <header className="home-header" data-site-header>
      <Link className="home-brand" to="/" aria-label={`${siteHome.title}首页`}>
        {siteHome.title}
      </Link>
      <nav className="home-nav" aria-label="主导航">
        <Link to="/notes">笔记</Link>
        <Link to="/fragments">碎片</Link>
        <Link className="home-nav-about" to="/about">
          关于
        </Link>
        <div className="home-more" ref={menuRef}>
          <button
            ref={moreButton}
            className="home-icon-button"
            type="button"
            aria-label="更多页面"
            aria-expanded={more}
            aria-controls="home-more-pages"
            onClick={() => setMore(!more)}
          >
            <MoreHorizontal aria-hidden="true" size={19} />
          </button>
          {more && (
            <div className="home-more-pages" id="home-more-pages">
              <Link to="/about">关于</Link>
              <Link to="/now">现在</Link>
              <Link to="/timeline">时间线</Link>
              <Link to="/journal">最新发布</Link>
              <Link to="/resources">私人资源</Link>
              <Link to="/wedding">婚礼纪念</Link>
            </div>
          )}
        </div>
        <PublicAiAssistant
          pagePath="/notes"
          launcher={({ ask }) => (
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  className="home-icon-button"
                  type="button"
                  aria-label="搜索笔记"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="home-search-overlay" />
                <Dialog.Content className="home-search-dialog">
                  <div className="home-search-heading">
                    <Dialog.Title>搜索笔记</Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        className="home-icon-button"
                        aria-label="关闭搜索"
                      >
                        <X size={19} />
                      </button>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description>
                    查找文章、已发布内容，或向 AI 提问。
                  </Dialog.Description>
                  <form onSubmit={submit}>
                    <label className="home-search-field">
                      <Search size={18} aria-hidden="true" />
                      <input
                        aria-label="搜索内容"
                        placeholder="输入关键词…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        maxLength={140}
                        type="search"
                      />
                    </label>
                  </form>
                  <div className="home-search-results" aria-live="polite">
                    <p>{normalized ? "匹配的内容" : "最近的内容"}</p>
                    {results.length ? (
                      results.map((item) => (
                        <Link
                          key={item.key}
                          to={item.href}
                          onClick={() => setOpen(false)}
                        >
                          <span>{item.title}</span>
                          <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                      ))
                    ) : (
                      <p>没有找到相关内容，试试其他关键词。</p>
                    )}
                  </div>
                  <button
                    className="home-ai-button"
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      window.setTimeout(
                        () => ask(query.trim() || "最近更新了什么？"),
                        0,
                      );
                    }}
                  >
                    <Bot size={17} aria-hidden="true" />
                    {query.trim() ? "向 AI 询问这个问题" : "问 AI"}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        />
      </nav>
    </header>
  );
}
