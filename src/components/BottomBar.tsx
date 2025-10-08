import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { CalendarDays, Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

const HERO_THRESHOLD = 0.3;
const FOOTER_THRESHOLD = 0.1;

export type BottomBarProps = {
  heroTargetId?: string;
  footerTargetId?: string;
  className?: string;
};

export default function BottomBar({
  heroTargetId = "carousel-hero-anchor",
  footerTargetId = "footer-anchor",
  className,
}: BottomBarProps): JSX.Element {
  const [isFloating, setIsFloating] = useState(false);

  useEffect(() => {
    const heroElement = heroTargetId ? document.getElementById(heroTargetId) : null;
    const footerElement = footerTargetId ? document.getElementById(footerTargetId) : null;

    if (!heroElement && !footerElement) {
      setIsFloating(false);
      return;
    }

    let heroInView = true;
    let footerInView = false;
    let rafId = 0;

    const isElementInViewport = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };

    const updateFloatingState = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(() => {
        const nextFloating = !heroInView && !footerInView;
        setIsFloating((previous) => (previous === nextFloating ? previous : nextFloating));
      });
    };

    const heroObserver = heroElement
      ? new IntersectionObserver(
        (entries) => {
          heroInView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
          updateFloatingState();
        },
        { threshold: HERO_THRESHOLD },
      )
      : null;

    const footerObserver = footerElement
      ? new IntersectionObserver(
        (entries) => {
          footerInView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
          updateFloatingState();
        },
        { threshold: FOOTER_THRESHOLD },
      )
      : null;

    if (heroElement && heroObserver) {
      heroObserver.observe(heroElement);
    }

    if (footerElement && footerObserver) {
      footerObserver.observe(footerElement);
    }

    heroInView = heroElement ? isElementInViewport(heroElement) : false;
    footerInView = footerElement ? isElementInViewport(footerElement) : false;
    updateFloatingState();

    return () => {
      heroObserver?.disconnect();
      footerObserver?.disconnect();
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [heroTargetId, footerTargetId]);

  const containerClasses = useMemo(
    () =>
      cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center transition-transform duration-500 ease-out",
        isFloating ? "translate-y-0" : "translate-y-full",
        className,
      ),
    [className, isFloating],
  );

  const handleViewSchedule = () => {
    const scheduleTarget = document.querySelector<HTMLElement>('[data-section="schedule"], #schedule');
    scheduleTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSendBlessing = () => {
    const wishesTarget = document.querySelector<HTMLElement>('[data-section="wishes"], #wishes');

    if (wishesTarget) {
      wishesTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window?.open(
      "mailto:?subject=" +
      encodeURIComponent("\u9001\u4e0a\u795d\u798f") +
      "&body=" + encodeURIComponent("\u795d\u798f\u8bed:"),
    );
  };

  return (
    <div className={containerClasses} aria-hidden={!isFloating}>
      <div className="pointer-events-auto mb-4 flex w-6/7 max-w-md items-center justify-between gap-3 rounded-md bg-background/95 px-4 py-3 text-sm shadow-lg ring-1 ring-border/60 backdrop-blur">
        <Button
          size="lg"
          variant="default"
          className="flex-1 gap-2 bg-primary text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.95]"
          onClick={handleViewSchedule}
        >
          <CalendarDays className="size-4" />
          {"\u67e5\u770b\u65e5\u7a0b"}
        </Button>
        <Button
          disabled
          size="lg"
          variant="secondary"
          className="flex-1 gap-2 bg-muted text-foreground transition-transform hover:bg-muted/90 active:scale-[0.95]"
          onClick={handleSendBlessing}
        >
          <Heart className="size-4" />
          {"\u53d1\u9001\u795d\u798f"}
          <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">
        不可用
      </Badge>
        </Button>
      </div>
    </div>
  );
}
