// HeroCarousel.tsx
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
import { CalendarDays, Clock3, Heart, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";

type ImageItem = { src: string; alt?: string; title?: string; subtitle?: string }

//读取图片
const mods = import.meta.glob('@/assets/gallery/hero/*.{jpg,png}', {
    eager: true, import: 'default', query: '?url'
})

const defaultImages: ImageItem[] = Object.values(mods).map((src) => ({ src: src as string }))

interface HeroCarouselProps {
    images?: ImageItem[]
    className?: string
}

export default function HeroCarousel({
    images = defaultImages,
    className,
}: HeroCarouselProps): JSX.Element {

    // 渐入渐出插件
    const fadePlugin = useMemo(() => Fade(), []);
    // 自动播放插件
    const autoplayPlugin = useRef(
        Autoplay({
            //自动切换间隔
            delay: 4000,
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
            className={cn("relative w-full h-[90dvh] overflow-hidden select-none", className)}
            aria-roledescription="carousel"
        >
            <Carousel
                setApi={setApi}
                opts={{ loop: true, align: "start" }}
                plugins={[fadePlugin, autoplayPlugin.current]}
                className={cn(" select-none absolute inset-0 h-full w-full [touch-action:auto]"
                )}>
                {/* ✅ 关键：蒙版不拦截事件 */}
                <div
                    className={cn(
                        "absolute inset-0 h-full w-full z-10 pointer-events-none",
                        "bg-black/90",
                        "bg-gradient-to-t from-black/90 via-black/50 to-transparent"
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
                                className="w-full h-full object-cover block select-none"
                                decoding="async"
                                loading="lazy"
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
            <div className="pointer-events-none absolute w-full inset-x-0 bottom-0 z-20 px-8 pb-10 text-white select-none ">
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
                                宁夏吴忠 · 青铜峡宾馆
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock3 className="size-4 text-white/70" />
                            <span>
                                2025年10月19日 · 上午11:28
                            </span>
                        </div>
                    </div>
                </div>
                <div className="py-6 z-40 mx-auto pb-24 sm:px-12 sm:pb-28">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
                        className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 text-white">
                        <Button
                            size="lg"
                            variant="secondary"
                            className="bg-white/90 text-black select-none transition-transform focus-visible:ring-white/60 hover:bg-white active:scale-[0.97] active:bg-white"
                            //todo:跳转日程
                            onClick={() => toast.error("功能未就绪", { duration: 2500, closeButton: false ,action:{
                                label:"关闭",
                                onClick: ()=>{}
                            }})}
                        >
                            <CalendarDays className="size-4" />
                            转到日程
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="border-white/70 bg-black/30 text-white select-none transition-transform focus-visible:ring-white/60 hover:bg-white/10 active:scale-[0.97] active:bg-white/20"
                            disabled
                        //todo: 跳转留言
                        >
                            <Heart className="size-4" />
                            留言
                            <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">
                                暂不可用
                            </Badge>
                        </Button>

                    </motion.div>
                </div>
            </div>

        </section>
    )
}
