import type { JSX } from "react";

import CarouselHero from "@/components/CarouselHero";
import ScheduleSection from "@/components/ScheduleSection";
import Footer from "@/components/Footer";

// Main Invitation Content
export default function MainContent(): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-12">
      <CarouselHero />
      <ScheduleSection />
      <Footer />
      {/* <Hero />
      <Events />
      <Location />
      <Gifts />
      <Wishes /> */}
    </section>
  );
}

