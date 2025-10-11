// FullscreenHeroCarousel.tsx
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel"
import Fade from "embla-carousel-fade";
import Autoplay from "embla-carousel-autoplay"
import { cn } from "@/lib/utils"

type ImageItem = { src: string; alt?: string; title?: string; subtitle?: string }

//读取图片
const mods = import.meta.glob('@/assets/gallery/hero/*.{jpg,png}', {
    eager: true, import: 'default', query: '?url'
})

const defaultImages: ImageItem[] = Object.values(mods).map((src) => ({ src: src as string }))

interface FullscreenHeroCarouselProps {
    images?: ImageItem[]
    className?: string
}

export default function HeroCarousel({
    images = defaultImages,
    className,
}: FullscreenHeroCarouselProps): JSX.Element {

    // 渐入渐出插件
    const fadePlugin = useMemo(() => Fade(), []);
    // 自动播放插件
    const autoplayPlugin = useRef(
        Autoplay({
            delay: 3000,
            stopOnInteraction: false,
            stopOnMouseEnter: false,
        })
    )
    // Carousel api
    const [api, setApi] = useState<CarouselApi | null>(null)
    const [selected, setSelected] = useState(0)
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!api) return
        const onSelect = () => setSelected(api.selectedScrollSnap())
        const onReInit = () => {
            setCount(api.scrollSnapList().length)
            onSelect()
        }
        setCount(api.scrollSnapList().length)
        onSelect()
        api.on("select", onSelect)
        api.on("reInit", onReInit)
        return () => {
            api.off("select", onSelect)
            api.off("reInit", onReInit)
        }
    }, [api])
    return (
        <section
            className={cn("relative w-full h-[88dvh] overflow-hidden select-none", className)}
            aria-roledescription="carousel"
        >
            <Carousel
                setApi={setApi}
                opts={{ loop: true, align: "start" }}
                plugins={[fadePlugin, autoplayPlugin.current]}
                className={cn("absolute inset-0 h-full w-full [touch-action:pan-x]"
                )}>
                {/* ✅ 关键：蒙版不拦截事件 */}
                <div
                    className={cn(
                        "absolute inset-0 h-full w-full z-10 pointer-events-none",
                        "bg-black/90",
                        "bg-gradient-to-t from-black/90 via-black/40 to-transparent"
                    )}
                    aria-hidden="true"
                />

                <CarouselContent className="absolute inset-0 w-full h-full ml-0">
                    {images.map((img, idx) => (
                        <CarouselItem
                            key={idx}
                            className="pl-0 h-full w-full basis-full"
                        >
                            {/* 背景图（全屏铺满） */}
                            <img
                                src={img.src}
                                alt={img.alt ?? ""}
                                className="w-full h-full object-cover block"
                                draggable={false}
                            />
                            {/* 如需文案，这里 z-20，仍可点到箭头 */}
                            {/* <div className="relative z-20 h-full" /> */}
                        </CarouselItem>
                    ))}
                </CarouselContent>

                {/* 底部圆点指示器 */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    {Array.from({ length: count }).map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => api?.scrollTo(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            aria-current={i === selected ? "true" : undefined}
                            className={cn(
                                "h-2.5 w-2.5 rounded-full transition-all",
                                i === selected
                                    ? "bg-white w-5 opacity-100 scale-100"
                                    : "bg-white/60 opacity-70 scale-75 hover:opacity-100"
                            )}
                        />
                    ))}
                </div>
            </Carousel>
        </section>
    )
}
