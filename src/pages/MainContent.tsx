import type { JSX } from "react";

import CarouselHero from "@/components/CarouselHero";
import ScheduleSection from "@/components/ScheduleSection";

// Main Invitation Content
export default function MainContent(): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-12">
      <CarouselHero />
      <ScheduleSection />
      {/* <Hero />
      <Events />
      <Location />
      <Gifts />
      <Wishes /> */}
    </section>
  );
}

