import type { JSX } from "react";

import BottomBar from "@/components/BottomBar";
import Footer from "@/components/Footer";
import ScheduleSection from "@/components/ScheduleSection";
import StorySection from "@/components/StorySection";
import HeroCarousel from "@/components/HeroCarousel";
import SectionStory from "@/components/SectionStory";
import { Helmet } from "react-helmet-async";
import config from "@/config/config";

export default function MainContent(): JSX.Element {
  return (
    <>
    {/* 标题 描述 OG图 */}
      <Helmet>
        <title>{config.data.title}</title>
        <meta name="title" content={config.data.title} />
        <meta property="og:title" content={config.data.title} />
        <meta name="description" content={config.data.description} />
        <meta property="og:description" content={config.data.description} />
        <meta name="description" content={config.data.description} />
        <link rel="image_src" href={config.data.og_image} />
        <meta property="og:image" content={config.data.og_image} />

      </Helmet>
      <section className="flex w-full flex-col">

        <div id="carousel-hero-anchor">
          <HeroCarousel />
        </div>
        <SectionStory />
      </section>
    </>

  );
}
