import { useState, type JSX } from "react";

import HeroCarousel from "@/components/wedding/HeroCarousel";
import SectionSchedule from "@/components/wedding/SectionSchedule";
import SectionStory from "@/components/wedding/SectionStory";
import config from "@/config/config";
import { Helmet } from "react-helmet-async";

export default function WeddingInvitation(): JSX.Element {
  const [isNoticeOpen, setIsNoticeOpen] = useState(true);

  return (
    <>
      <Helmet>
        <title>{config.data.title}</title>
        <meta name="title" content={config.data.title} />
        <meta name="description" content={config.data.description} />
        <meta property="og:title" content={config.data.title} />
        <meta property="og:description" content={config.data.description} />
        <meta property="og:type" content="website" />
        <link rel="image_src" href={config.data.og_image} />
        <meta property="og:image" content={config.data.og_image} />
        <meta property="og:image:alt" content={config.data.title} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={config.data.title} />
        <meta name="twitter:description" content={config.data.description} />
        <meta name="twitter:image" content={config.data.og_image} />
      </Helmet>

      {isNoticeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-sm"
          role="presentation"
        >
          <div
            aria-describedby="page-notice-description"
            aria-labelledby="page-notice-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/95 p-6 text-center shadow-2xl"
            role="dialog"
          >
            <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-700">
              !
            </div>
            <h2
              className="text-lg font-semibold tracking-wide text-slate-900"
              id="page-notice-title"
            >
              温馨提示
            </h2>
            <p
              className="mt-3 text-sm leading-6 text-slate-600"
              id="page-notice-description"
            >
              页面尚未完善，所展示的信息可能不准确。
            </p>
            <button
              autoFocus
              className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              onClick={() => setIsNoticeOpen(false)}
              type="button"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      <section className="flex w-full flex-col">
        <div id="carousel-hero-anchor">
          <HeroCarousel />
        </div>
        <SectionStory />
        <SectionSchedule />
      </section>
    </>
  );
}
