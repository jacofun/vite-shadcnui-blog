import type { JSX } from "react";

import CarouselHero from "@/components/CarouselHero";
import BottomBar from "@/components/BottomBar";
import Footer from "@/components/Footer";
import ScheduleSection from "@/components/ScheduleSection";
import StorySection from "@/components/StorySection";
import HeroCarousel from "@/components/HeroCarousel";

export default function MainContent(): JSX.Element {
  return (
    <section className="flex w-full flex-col">
      <HeroCarousel/>
      {/* <div id="carousel-hero-anchor">
        <CarouselHero />
      </div>
      <StorySection />
      <ScheduleSection />
      <div id="footer-anchor">
        <Footer />
      </div>
      <BottomBar /> */}
    </section>
  );
}
