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
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { motion } from "framer-motion";
import { useWalineLike } from "@/components/hooks/useWalineLike"
import { toast } from "sonner";
import { Spinner } from "../ui/spinner";



type ImageItem = { src: string; alt?: string; title?: string; subtitle?: string }




interface HeroCarouselProps {
    images?: ImageItem[]
    className?: string
}
// === 批量导入（imagetools 模式）===
const mods = import.meta.glob('@/assets/gallery/hero/*.{jpg,jpeg,png}', {
    eager: true,
    import: 'default',
    query: {
        as: 'picture',
        format: 'avif;webp;jpg',
        w: '640;828;1080;1440',
    },
})

const likedMessages = [
    "谢谢你的祝福噢...❤️",
    "收到你一份爱的点赞～💌",
    "爱心+1，幸福加倍~💕",
    "愿喜悦也传递给你~🎉",
    "你的祝福抵达啦！✨",
    "愿你也被温柔以待。💐",
    "比心成功！📨💘",
    "小红心已签收~💕"
];

type PictureVariant = {
    sources?: Array<{ type: string; srcset: string }>
    img?: { src: string; width: number; height: number }
}

// 把 glob 结果归一化为统一结构，兼容“字符串 URL / 非 picture 对象”
const slidesFromFolder = Object.values(mods).map((mod: unknown) => {
    if (typeof mod === 'string') {
        // 说明当前条目不是 picture 结构（比如插件未生效或某张图被当作 url）
        return {
            src: mod,
            width: undefined as number | undefined,
            height: undefined as number | undefined,
            sources: [] as Array<{ type: string; srcset: string }>,
        }
    }
    const p = mod as PictureVariant
    // 再防御一次：即便是对象，也可能没有 sources/img
    return {
        src: p.img?.src ?? '',
        width: p.img?.width,
        height: p.img?.height,
        sources: Array.isArray(p.sources) ? p.sources : [],
    }
})
export default function HeroCarousel({
    className,
}: HeroCarouselProps): JSX.Element {
    const { likedCount, liked, loading, like } = useWalineLike({
        serverURL: "https://waline.yanxiao.me", // 你的 Waline 服务地址
        path: typeof window !== "undefined" ? location.pathname : "/",
        emoji: "❤️", // 或者 "heart" 视你的服务端配置
    });

    const msg = likedMessages[Math.floor(Math.random() * likedMessages.length)];
    // 是否大屏幕（>1024px）
    const isLargeScreen = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
    // 渐入渐出插件
    const fadePlugin = useMemo(() => Fade(), []);
    // 自动播放插件
    // 自动播放插件
    const autoplayPlugin = useRef(
        isLargeScreen
            ? undefined // 大屏幕禁用自动播放
            : Autoplay({
                delay: 4000,
                stopOnInteraction: false,
                stopOnMouseEnter: false,
            })
    );
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
            className={cn("relative w-full h-[90svh] sm:h-[60dvh] overflow-hidden select-none md:max-w-3/4 mx-auto", className)}
            aria-roledescription="carousel"
        >
            <Carousel
                setApi={setApi}
                opts={{ loop: true, align: "start", duration: 10, dragFree: false }}
                plugins={[fadePlugin, ...(autoplayPlugin.current ? [autoplayPlugin.current] : [])]}
                className={cn(" select-none absolute inset-0 h-full w-full [touch-action:auto] "
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
                    {slidesFromFolder.map((item, idx) => (
                        <CarouselItem key={idx} className="pl-0 h-full w-full basis-full">
                            <picture className="absolute inset-0 block h-full w-full sm:cursor-pointer">
                                {/* 可选链 + 安全遍历，sources 可能为空数组 */}
                                {item.sources?.map((s) => (
                                    <source key={s.type} type={s.type} srcSet={s.srcset} sizes="100vw" />
                                ))}
                                <img
                                    src={item.src}                       // 归一化后始终有字符串（可能空串）
                                    width={item.width}                   // 允许 undefined，浏览器可自行布局
                                    height={item.height}
                                    draggable={false}
                                    className="h-full w-full object-cover"
                                    loading={idx === 0 ? 'eager' : 'lazy'}
                                    decoding="async"
                                />
                            </picture>
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
                                "h-2.5 w-2.5 rounded-full transition-all sm:cursor-pointer",
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
                        我们诚挚邀请您，共同见证一段温暖和喜悦。
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
                <div className="py-6 z-40 mx-auto pb-24 sm:pb-28">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        viewport={{ once: true, amount: 0.3 }} // 只执行一次，30%进入视口就触发
                        className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 text-white">
                        <Button
                            size="lg"
                            variant="secondary"
                            className="bg-white/90 sm:cursor-pointer text-black sm:text-xl select-none transition-transform focus-visible:ring-white/60 hover:bg-white active:scale-[0.90] active:bg-white"
                            //todo:跳转日程
                            onClick={() => {
                                document.getElementById("schedule")?.scrollIntoView({
                                    behavior: "smooth", // 平滑滚动
                                    block: "start",     // 对齐到顶部
                                });
                            }}
                        >
                            <CalendarDays className="size-5" />
                            转到日程
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className={cn("border-white/70 bg-black/30 sm:text-xl sm:cursor-pointer text-white select-none transition-transform active:scale-[0.90] hover:bg-white/50 ",
                                liked && "bg-white/20 ring-1 ring-white/50")}
                            aria-pressed={liked}
                            aria-label={liked ? "取消点赞" : "点赞"}
                            title={liked ? "已点赞" : "点赞一下"}
                            disabled={loading}

                            onClick={() => (like(), toast(msg))}
                        >
                            <Heart
                                className={cn(
                                    "size-5 transition-transform",
                                    liked
                                        // ✅ 已点赞：填充红色、去描边（或保留细描边看你喜好）
                                        ? "text-red-500 scale-110 [&>path]:fill-current [&>path]:stroke-current [&>path]:stroke-0"
                                        // 未点赞：空心
                                        : "text-white [&>path]:fill-none [&>path]:stroke-current"
                                )}
                            />
                            {/* ✅ 动态显示 Badge */}
                            {loading ? (
                                <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">
                                    <Spinner />
                                </Badge>
                            ) : likedCount > 0 ? (
                                <Badge variant="destructive" className="px-2 py-0.5 text-[10px]">
                                    {likedCount}
                                </Badge>
                            ) : null}
                        </Button>
                    </motion.div>
                </div>
            </div>

        </section>
    )
}
