import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import useEmblaCarousel from "embla-carousel-react";

import { cn } from "@/lib/utils";

const AUTOPLAY_DELAY = 6000;
const NAVBAR_RESERVE = 88; // reserve ~88px for typical mobile bottom nav
const TRANSITION_DURATION = 700;

const defaultImages = [
  {
    src: "/images/2Y6A6844.jpg",
    alt: "Bride and groom smiling during an outdoor shoot",
  },
  {
    src: "/images/2Y6A6872.jpg",
    alt: "Couple walking hand in hand",
  },
  {
    src: "/images/2Y6A7048.jpg",
    alt: "Close-up portrait capturing a candid laugh",
  },
  {
    src: "/images/2Y6A7070.jpg",
    alt: "Couple embracing at golden hour",
  },
];

export type CarouselHeroProps = {
  images?: Array<{ src: string; alt?: string }>;
  className?: string;
};

export default function CarouselHero({
  images: overrideImages,
  className,
}: CarouselHeroProps): JSX.Element {
  const images = useMemo(() => {
    const selected = overrideImages?.length ? overrideImages : defaultImages;
    return selected.map((image, index) => ({
      alt: image.alt ?? `Carousel slide ${index + 1}`,
      src: image.src,
    }));
  }, [overrideImages]);

  const [activeIndex, setActiveIndex] = useState(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: images.length > 1,
    align: "start",
    duration: 20,
    skipSnaps: false,
  });

  useEffect(() => {
    setActiveIndex(0);
  }, [images.length]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    const stopAutoplay = () => {
      if (autoplayRef.current !== null) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };

    const startAutoplay = () => {
      if (images.length <= 1) {
        return;
      }

      stopAutoplay();
      autoplayRef.current = setInterval(() => {
        if (!emblaApi) {
          return;
        }
        if (emblaApi.canScrollNext()) {
          emblaApi.scrollNext();
        } else {
          emblaApi.scrollTo(0);
        }
      }, AUTOPLAY_DELAY);
    };

    const selectHandler = () => {
      setActiveIndex(emblaApi.selectedScrollSnap());
    };

    const selectAndPlayHandler = () => {
      selectHandler();
      startAutoplay();
    };

    const reInitHandler = () => {
      selectHandler();
      startAutoplay();
    };

    const pointerDownHandler = () => {
      stopAutoplay();
    };

    const pointerUpHandler = () => {
      startAutoplay();
    };

    selectHandler();
    startAutoplay();

    emblaApi.on("select", selectAndPlayHandler);
    emblaApi.on("reInit", reInitHandler);
    emblaApi.on("pointerDown", pointerDownHandler);
    emblaApi.on("pointerUp", pointerUpHandler);
    emblaApi.on("pointerLeave", pointerUpHandler);

    return () => {
      stopAutoplay();
      emblaApi.off("select", selectAndPlayHandler);
      emblaApi.off("reInit", reInitHandler);
      emblaApi.off("pointerDown", pointerDownHandler);
      emblaApi.off("pointerUp", pointerUpHandler);
      emblaApi.off("pointerLeave", pointerUpHandler);
    };
  }, [emblaApi, images.length]);

  const handleDotClick = useCallback(
    (index: number) => {
      if (!emblaApi) {
        setActiveIndex(index);
        return;
      }
      emblaApi.scrollTo(index);
    },
    [emblaApi],
  );

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="relative w-full bg-zinc-900"
        style={{ height: `calc(100vh - ${NAVBAR_RESERVE}px)` }}
      >
        <div className="absolute inset-0 z-0 overflow-hidden touch-pan-y" ref={emblaRef}>
          <div className="flex h-full">
            {images.map((image, index) => (
              <div
                key={`slide-${image.src}-${index}`}
                className="h-full flex-[0_0_100%]"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 z-10">
          {images.map((image, index) => (
            <img
              key={image.src}
              src={image.src}
              alt={image.alt}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity",
                index === activeIndex ? "opacity-100" : "opacity-0",
              )}
              style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
            />
          ))}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
          {images.map((_image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`dot-${_image.src}-${index}`}
                type="button"
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  isActive ? "w-6 bg-white/90" : "bg-white/50",
                )}
                aria-label={`Go to slide ${index + 1}`}
                aria-pressed={isActive}
                onClick={() => handleDotClick(index)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
