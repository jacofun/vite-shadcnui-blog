import { useEffect, useRef, useState, type JSX } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type ImageItem = { src: string; alt?: string; title?: string; subtitle?: string };

const mods = import.meta.glob("@/assets/gallery/story/*.{jpg,jpeg,png}", {
  eager: true,
  import: "default",
  query: {
    as: "picture",
    format: "avif;webp;jpg",
    w: "640;828;1080;1440",
  },
});

type PictureVariant = {
  sources?: Array<{ type: string; srcset: string }>;
  img?: { src: string; width: number; height: number };
};

const slidesFromFolder = Object.values(mods).map((mod: unknown) => {
  if (typeof mod === "string") {
    return {
      src: mod,
      width: undefined as number | undefined,
      height: undefined as number | undefined,
      sources: [] as Array<{ type: string; srcset: string }>,
    };
  }

  const picture = mod as PictureVariant;
  return {
    src: picture.img?.src ?? "",
    width: picture.img?.width,
    height: picture.img?.height,
    sources: Array.isArray(picture.sources) ? picture.sources : [],
  };
});

interface SectionStoryProps {
  images?: ImageItem[];
  className?: string;
}

export default function SectionStory({
  className,
}: SectionStoryProps): JSX.Element {
  const isLargeScreen =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 640px)").matches;

  const autoplayPlugin = useRef(
    isLargeScreen
      ? undefined
      : Autoplay({
          delay: 4000,
          stopOnInteraction: false,
          stopOnMouseEnter: false,
        })
  );

  const [api, setApi] = useState<CarouselApi | null>(null);
  const [selected, setSelected] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setSelected(api.selectedScrollSnap());
    const onReInit = () => {
      setCount(api.scrollSnapList().length);
      onSelect();
    };

    setCount(api.scrollSnapList().length);
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onReInit);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onReInit);
    };
  }, [api]);

  return (
    <section
      id="story"
      data-section="story"
      className={cn(
        "relative w-full flex items-center md:max-w-3/4 mx-auto gap-6 flex-col min-h-[50svh] h-auto bg-[#fff1ec] overflow-hidden select-none py-8 [touch-action:auto]",
        className
      )}
      aria-roledescription="carousel"
    >
      <div className="mx-auto text-center items-center w-full max-w-5xl gap-3 px-5">
        <span className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
          Story
        </span>
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          viewport={{ once: true, amount: 0.3 }}
          className="w-full space-y-3"
        >
          <h2 className="text-3xl font-semibold tracking-[0.2em] text-foreground sm:text-4xl">
            遇见
          </h2>
          <p className="text-base text-muted-foreground">
            婚纱照里的光影
            <br />
            是我们一路走来的缩影
            <br />
            每一次按下快门
            <br />
            都是将相遇的惊喜与相知的暖意留在时间里。
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        viewport={{ once: true, amount: 0.3 }}
      >
        <Carousel
          setApi={setApi}
          opts={{ loop: true, align: "center" }}
          plugins={[
            ...(autoplayPlugin.current ? [autoplayPlugin.current] : []),
          ]}
          className={cn("relative w-full [touch-action:auto]")}
        >
          <CarouselContent className="w-full">
            {slidesFromFolder.map((item, idx) => (
              <CarouselItem
                key={item.src || idx}
                className="basis-[85%] w-full max-h-[80svh] sm:basis-[50%] sm:max-w-3/4"
              >
                <picture className="inset-0 block h-full w-full sm:cursor-pointer">
                  {item.sources.map((source) => (
                    <source
                      key={source.type}
                      type={source.type}
                      srcSet={source.srcset}
                      sizes="(min-width: 640px) 50vw, 85vw"
                    />
                  ))}
                  <img
                    src={item.src}
                    width={item.width}
                    height={item.height}
                    alt={`婚礼故事照片 ${idx + 1}`}
                    className="w-full h-full object-cover block select-none object-center transition-opacity rounded-3xl"
                    draggable={false}
                    decoding="async"
                    loading="lazy"
                  />
                </picture>
              </CarouselItem>
            ))}
          </CarouselContent>

          <div className="absolute bottom-1/24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {Array.from({ length: count }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => api?.scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === selected ? "true" : undefined}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all sm:cursor-pointer",
                  index === selected
                    ? "bg-white w-5 opacity-100 scale-100"
                    : "bg-white/60 opacity-70 scale-75 hover:opacity-100"
                )}
              />
            ))}
          </div>
        </Carousel>
      </motion.div>
    </section>
  );
}
