// HeroCarousel.tsx
import { useEffect, useRef, useState, type JSX } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion";

type ImageItem = { src: string; alt?: string; title?: string; subtitle?: string }

//读取图片
const mods = import.meta.glob('@/assets/gallery/story/*.{jpg,png}', {
    eager: true, import: 'default', query: '?url'
})

const defaultImages: ImageItem[] = Object.values(mods).map((src) => ({ src: src as string }))

interface SectionStoryProps {
    images?: ImageItem[]
    className?: string
}

export default function SectionStory({
    images = defaultImages,
    className,
}: SectionStoryProps): JSX.Element {
    // 自动播放插件
    const autoplayPlugin = useRef(
        Autoplay({
            //自动切换间隔
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
            id="story"
            data-section="story"
            className={cn("relative w-full flex items-center md:max-w-3/4 mx-auto gap-6 flex-col min-h-screen h-auto bg-[#fff1ec] overflow-hidden select-none py-8 [touch-action:auto]", className)}
            aria-roledescription="carousel"
        >
            {/* 文字区域 */}
            <div className="mx-auto text-center items-center w-full max-w-5xl gap-3 px-5">
                <span className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                    Story
                </span>
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
                    className="w-full space-y-3">
                    <h2
                        className="text-3xl font-semibold tracking-[0.2em] text-foreground sm:text-4xl">
                        遇见
                    </h2>
                    <p
                        className="text-base text-muted-foreground">
                        婚纱照里的光影<br/>
                        是我们一路走来的缩影<br/>
                        每一次按下快门<br/>
                        都是将相遇的惊喜与相知的暖意留在时间里。
                    </p>
                </motion.div>
            </div>

            {/* 轮播区域 */}
            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
                
            >
                <Carousel
                    setApi={setApi}
                    opts={{ loop: true, align: "center" }}
                    plugins={[autoplayPlugin.current]}
                    className={cn(" relative w-full [touch-action:auto] "
                    )}>

                    <CarouselContent className="w-full">
                        {images.map((img, idx) => (
                            <CarouselItem
                                key={idx}
                                className="basis-[85%] w-full sm:basis-[50%] sm:max-w-3/4"
                            >
                                {/* 背景图（全屏铺满） */}
                                <img
                                    src={img.src}
                                    alt={img.alt ?? ""}
                                    className=" w-full h-full object-cover block select-none object-center transition-opacity rounded-3xl"
                                    draggable={false}
                                    decoding="async"
                                    loading="lazy"
                                />
                                {/* 如需文案，这里 z-20，仍可点到箭头 */}
                                {/* <div className="relative z-20 h-full" /> */}
                            </CarouselItem>
                        ))}
                    </CarouselContent>

                    {/* 底部圆点指示器 */}
                    <div className="absolute bottom-1/24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
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
            </motion.div>
        </section>
    )
}