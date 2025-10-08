import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { CalendarDays, Clock3, MapPin, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  onViewSchedule?: () => void;
  onSendBlessing?: () => void;
};

export default function CarouselHero({
  images: overrideImages,
  className,
  onViewSchedule,
  onSendBlessing,
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

  const handleViewSchedule = useCallback(() => {
    if (onViewSchedule) {
      onViewSchedule();
      return;
    }

    const scheduleTarget = document.querySelector<HTMLElement>('[data-section="schedule"], #schedule');
    scheduleTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [onViewSchedule]);

  const handleSendBlessing = useCallback(() => {
    if (onSendBlessing) {
      onSendBlessing();
      return;
    }

    const wishesTarget = document.querySelector<HTMLElement>('[data-section="wishes"], #wishes');
    if (wishesTarget) {
      wishesTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window?.open(
      "mailto:?subject=" +
        encodeURIComponent("\u9001\u4e0a\u795d\u798f") +
        "&body=" + encodeURIComponent("\u795d\u798f\u8bed:")
    );
  }, [onSendBlessing]);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        className="relative w-full bg-zinc-900 select-none"
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
                "absolute inset-0 h-full w-full select-none object-cover transition-opacity",
                index === activeIndex ? "opacity-100" : "opacity-0",
              )}
              style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-3/5 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pb-40 text-white select-none sm:px-12 sm:pb-44">
          <div className="max-w-xl space-y-5 text-left">
            <p className="text-xs uppercase tracking-[0.6em] text-white/70 sm:text-sm">
              Wedding Invitation
            </p>
            <p className="text-xs uppercase tracking-[0.6em] text-white/70 sm:text-sm">
              婚礼邀请
            </p>
            <h1 className="text-2xl font-bold sm:text-5xl">
              吴彦骁 & 焦芮
            </h1>
            <p className="text-base  text-white/80 sm:text-lg">
              我们诚挚邀请您，共同见证一段温柔和喜悦。
            </p>
            <div className="space-y-2 text-sm text-white/85 sm:text-base">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-white/70" />
                <span>
                  {"\u5b81\u590f\u5434\u5fe0"} {"\u00b7"} {"\u9752\u94dc\u5ce1\u5bbe\u9986"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 text-white/70" />
                <span>
                  {"2025\u5e7410\u670819\u65e5"} {"\u00b7"} {"\u4e0a\u534811:28"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-40 px-6 pb-24 sm:px-12 sm:pb-28">
          <div className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 text-white">
            <Button
              size="lg"
              variant="secondary"
              className="bg-white/90 text-black select-none transition-transform focus-visible:ring-white/60 hover:bg-white active:scale-[0.97] active:bg-white"
              onClick={handleViewSchedule}
            >
              <CalendarDays className="size-4" />
              {"\u67e5\u770b\u65e5\u7a0b"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/70 bg-black/30 text-white select-none transition-transform focus-visible:ring-white/60 hover:bg-white/10 active:scale-[0.97] active:bg-white/20"
              onClick={handleSendBlessing}
            >
              <Send className="size-4" />
              {"\u53d1\u9001\u795d\u798f"}
            </Button>
          </div>
        </div>
      </div>

      {images.length > 1 ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-4 z-40 flex items-center justify-center gap-2">
          {images.map((_image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`dot-${_image.src}-${index}`}
                type="button"
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  isActive ? "w-6 bg-white" : "bg-white/50",
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
