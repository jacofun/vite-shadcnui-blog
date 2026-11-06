import * as Dialog from "@radix-ui/react-dialog";
import { useState, type JSX } from "react";
import { ArrowRight, ArrowUpRight, Play, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useOutletContext } from "react-router-dom";

import PublishingVideo from "@/components/common/PublishingVideo";
import { siteHome } from "@/config/config";
import {
  selectHomeContent,
  type HomeContent,
} from "@/lib/homeContent";
import "./Home.css";

function ContentMeta({ item }: { item: HomeContent }) {
  return (
    <p className="home-content-meta">
      {item.category}
      {item.readingMinutes
        ? ` · ${item.readingMinutes} 分钟`
        : item.media.some((media) => media.kind === "video")
          ? " · 视频"
          : ""}
    </p>
  );
}

function Featured({ item }: { item: HomeContent }) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const image = item.media.find(
    (media) => media.kind === "image" && !failedImages.includes(media.url),
  );
  const video = item.media.find((media) => media.kind === "video");
  if (image)
    return (
      <Link
        className="home-feature home-feature-image"
        to={item.href}
        data-home-feature="image"
      >
        <img
          src={image.url}
          alt={image.alt}
          fetchPriority="high"
          decoding="async"
          onError={() => setFailedImages((current) => [...current, image.url])}
        />
        <div className="home-feature-shade" aria-hidden="true" />
        <div className="home-feature-copy">
          <span className="home-eyebrow">{item.category}</span>
          <h1>{item.title}</h1>
          <div className="home-feature-bottom">
            <p>{item.summary}</p>
            <span>
              {video ? <Play size={15} aria-hidden="true" /> : null}
              {video ? "观看记录" : "查看记录"}
              <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    );
  return (
    <section
      className="home-feature home-feature-text"
      data-home-feature={video ? "video" : "text"}
    >
      <div className="home-feature-copy">
        <span className="home-eyebrow">{item.category}</span>
        <h1>
          <Link to={item.href}>{item.title}</Link>
        </h1>
        {item.summary && <p className="home-feature-summary">{item.summary}</p>}
        <div className="home-feature-actions">
          {video && (
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button className="home-watch-button" type="button">
                  <Play size={16} aria-hidden="true" />
                  播放视频
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="home-search-overlay" />
                <Dialog.Content className="home-video-dialog">
                  <Dialog.Title>{item.title}</Dialog.Title>
                  <Dialog.Description className="home-sr-only">
                    使用播放器控制播放、声音及全屏。
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button
                      className="home-icon-button home-video-close"
                      aria-label="关闭视频"
                    >
                      <X size={20} />
                    </button>
                  </Dialog.Close>
                  <PublishingVideo src={video.url} name={item.title} />
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
          <Link className="home-read-link" to={item.href}>
            {video ? "查看完整记录" : "阅读全文"}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Selected({ item }: { item: HomeContent }) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const image = item.media.find(
    (media) => media.kind === "image" && !failedImages.includes(media.url),
  );
  const video = item.media.some((media) => media.kind === "video");
  return (
    <Link
      className={`home-selected-item ${image ? "has-image" : ""}`}
      to={item.href}
      data-home-selected
    >
      {image && (
        <span className="home-selected-image">
          <img
            src={image.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() =>
              setFailedImages((current) => [...current, image.url])
            }
          />
          {video && (
            <span className="home-selected-play">
              <Play size={18} aria-hidden="true" />
            </span>
          )}
        </span>
      )}
      <div className="home-selected-copy">
        <ContentMeta item={item} />
        <h3>{item.title}</h3>
        {!image && item.summary && (
          <p className="home-selected-summary">{item.summary}</p>
        )}
      </div>
      <ArrowUpRight
        className="home-selected-arrow"
        size={17}
        aria-hidden="true"
      />
    </Link>
  );
}

export default function Home(): JSX.Element {
  const items = useOutletContext<HomeContent[]>();
  const { featured, selected } = selectHomeContent(
    items,
    siteHome.featuredHref,
    siteHome.selectionLimit,
  );
  return (
    <>
      <Helmet>
        <title>{siteHome.title}</title>
        <meta name="description" content={siteHome.description} />
        <link href="https://yanxiao.me/" rel="canonical" />
        <meta property="og:title" content={siteHome.title} />
        <meta property="og:description" content={siteHome.description} />
        <meta property="og:url" content="https://yanxiao.me/" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="home-page">
        <div className="home-shell">
          <main className="home-main">
            <div className="home-intro">
              <p>{siteHome.description}</p>
              <span>PERSONAL JOURNAL</span>
            </div>
            {featured ? (
              <Featured key={featured.key} item={featured} />
            ) : (
              <section className="home-feature home-feature-text">
                <div className="home-feature-copy">
                  <h1>{siteHome.title}</h1>
                  <Link className="home-read-link" to="/notes">
                    浏览笔记
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            )}
            {selected.length > 0 && (
              <section
                className="home-selection"
                aria-labelledby="home-selection-heading"
              >
                <div className="home-section-heading">
                  <h2 id="home-selection-heading">最近留下的</h2>
                  <Link to="/notes">
                    全部笔记
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                <div className="home-selected-grid">
                  {selected.map((item) => (
                    <Selected key={item.key} item={item} />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
