import type { JSX } from "react";

import HeroCarousel from "@/components/wedding/HeroCarousel";
import SectionSchedule from "@/components/wedding/SectionSchedule";
import SectionStory from "@/components/wedding/SectionStory";
import config from "@/config/config";
import { Helmet } from "react-helmet-async";

export default function WeddingInvitation(): JSX.Element {
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

      <section className="flex w-full flex-col">
        <p className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 px-4 py-2 text-center text-xs tracking-[0.28em] text-amber-900/70">
          岁月留影 · 2024.12.24
        </p>
        <div id="carousel-hero-anchor">
          <HeroCarousel />
        </div>
        <SectionStory />
        <SectionSchedule />
      </section>
    </>
  );
}
