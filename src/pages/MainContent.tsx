import type { JSX } from "react";

import CarouselHero from "@/components/CarouselHero";

// Main Invitation Content
export default function MainContent(): JSX.Element {
  return (
    <section className="flex w-full flex-col">
      <CarouselHero />
      {/* <Hero />
      <Events />
      <Location />
      <Gifts />
      <Wishes /> */}
    </section>
  );
}
