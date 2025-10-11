import type { JSX } from "react";

import BottomBar from "@/components/BottomBar";
import Footer from "@/components/Footer";
import ScheduleSection from "@/components/ScheduleSection";
import StorySection from "@/components/StorySection";
import HeroCarousel from "@/components/HeroCarousel";
import SectionStory from "@/components/SectionStory";

export default function MainContent(): JSX.Element {
  return (
    <section className="flex w-full flex-col">
     
      <div id="carousel-hero-anchor">
 <HeroCarousel/>
      </div>
      <SectionStory/>
      {/* <ScheduleSection /> */}
      <div id="footer-anchor">
        <Footer />
      </div>
      {/* <BottomBar /> */}
    </section>
  );
}
