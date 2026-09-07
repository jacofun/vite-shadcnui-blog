import type { JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Toaster } from "sonner";

import HeroCarousel from "@/components/wedding/HeroCarousel";
import SectionSchedule from "@/components/wedding/SectionSchedule";
import SectionStory from "@/components/wedding/SectionStory";
import config from "@/config/config";

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

      <div className="w-full bg-[#070a12] md:py-8">
        <section className="mx-auto flex w-full flex-col overflow-hidden bg-[#fff1ec] md:max-w-[430px] md:shadow-[0_24px_80px_rgba(0,0,0,0.30)]">
          <div id="carousel-hero-anchor">
            <HeroCarousel />
          </div>
          <SectionStory />
          <SectionSchedule />
        </section>
      </div>
      <Toaster richColors position="top-center" />
    </>
  );
}
