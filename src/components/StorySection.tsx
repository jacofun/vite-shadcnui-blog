import type { JSX } from "react";
import { useEffect, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const STORY_SLIDES = [
  {
    src: "/images/2Y6A6844.jpg",
    description: "初见时的一颦一笑，像命运悄悄翻开了新的一页。",
  },
  {
    src: "/images/2Y6A7070.jpg",
    description: "沿着日常的轨迹，我们将彼此的故事写进了生活。",
  },
  {
    src: "/images/8.2212101.jpg",
    description: "在无数次对视的瞬间，坚定了把未来交给对方的决定。",
  },
  {
    src: "/images/8.2212290.jpg",
    description: "愿余生的每一步，都与你一起看遍风景。",
  }
];

export default function StorySection(): JSX.Element {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => setCurrent(api.selectedScrollSnap());
    handleSelect();
    api.on("select", handleSelect);

    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  return (
    <section
      id="story"
      data-section="story"
      className="w-full bg-[#fff1ec] py-16 sm:py-20"
    >
      <div className="mx-auto flex items-center text-center w-full max-w-5xl flex-col gap-10 px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
            Story
          </p>
          <h2 className="text-3xl font-semibold tracking-[0.2em] text-foreground sm:text-4xl">
            遇见
          </h2>
          <p className="text-base text-muted-foreground">
            婚纱照里的光影，是我们一路走来的缩影。每一次按下快门，都是将相遇的惊喜与相知的暖意留在时间里。
          </p>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: false, skipSnaps: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4 md:-ml-6">
            {STORY_SLIDES.map((slide) => (
              <CarouselItem
                key={slide.src}
                className="min-w-0 basis-[85%] pl-4 md:basis-[60%] md:pl-6 lg:basis-[50%] xl:basis-[45%]"
              >
                <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-white/95 shadow-sm">
                  <img
                    src={slide.src}
                    className="h-full w-full object-cover select-none transition-opacity"
                    decoding="async"
                    loading="lazy"
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 60vw, 45vw"
                    width={1080}  // 用目标展示最大宽度
                    height={720}  // 按你的照片比例填写
                    
                  />
                  <div className="space-y-1 px-5 py-4">
                    <p className="text-sm text-muted-foreground">
                      {slide.description}
                    </p>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="flex items-center justify-center gap-3">
          {STORY_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`跳转到第 ${index + 1} 张照片`}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "h-2 w-2 rounded-full bg-foreground/20 transition-all",
                current === index && "w-6 bg-primary"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
