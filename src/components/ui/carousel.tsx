import * as React from "react"
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type CarouselApi = EmblaCarouselType
export type CarouselOptions = EmblaOptionsType
export type CarouselPlugin = EmblaPluginType

type CarouselContextProps = {
  api: CarouselApi | undefined
  orientation: "horizontal" | "vertical"
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarouselContext() {
  const context = React.useContext(CarouselContext)
  if (!context) {
    throw new Error("Carousel components must be used within <Carousel />")
  }
  return context
}

type CarouselProps = React.HTMLAttributes<HTMLDivElement> & {
  opts?: CarouselOptions
  plugins?: CarouselPlugin[]
  orientation?: "horizontal" | "vertical"
}

export const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  (
    {
      className,
      children,
      opts,
      plugins,
      orientation = "horizontal",
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        align: "start",
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    )

    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)

    const onSelect = React.useCallback((embla: CarouselApi) => {
      setCanScrollPrev(embla.canScrollPrev())
      setCanScrollNext(embla.canScrollNext())
    }, [])

    React.useEffect(() => {
      if (!api) return
      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api.off("select", onSelect)
        api.off("reInit", onSelect)
      }
    }, [api, onSelect])

    return (
      <CarouselContext.Provider value={{ api, orientation, canScrollPrev, canScrollNext }}>
        <div ref={ref} className={cn("relative", className)} {...props}>
          <div ref={carouselRef} className="overflow-hidden">
            {children}
          </div>
        </div>
      </CarouselContext.Provider>
    )
  },
)
Carousel.displayName = "Carousel"

type CarouselContentProps = React.HTMLAttributes<HTMLDivElement>

export const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarouselContext()
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    )
  },
)
CarouselContent.displayName = "CarouselContent"

type CarouselItemProps = React.HTMLAttributes<HTMLDivElement>

export const CarouselItem = React.forwardRef<HTMLDivElement, CarouselItemProps>(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarouselContext()
    return (
      <div
        ref={ref}
        className={cn(
          "min-w-0 shrink-0 grow-0 basis-full pl-4",
          orientation === "vertical" && "pl-0 pt-4",
          className,
        )}
        {...props}
      />
    )
  },
)
CarouselItem.displayName = "CarouselItem"

type CarouselButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const baseButtonClass =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-md transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"

export const CarouselPrevious = React.forwardRef<HTMLButtonElement, CarouselButtonProps>(
  ({ className, children, ...props }, ref) => {
    const { api, canScrollPrev } = useCarouselContext()
    return (
      <button
        ref={ref}
        className={cn(baseButtonClass, "left-3", className)}
        disabled={!canScrollPrev}
        onClick={(event) => {
          props.onClick?.(event)
          if (event.defaultPrevented) return
          api?.scrollPrev()
        }}
        {...props}
      >
        {children ?? (
          <>
            <span className="sr-only">Previous slide</span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    )
  },
)
CarouselPrevious.displayName = "CarouselPrevious"

export const CarouselNext = React.forwardRef<HTMLButtonElement, CarouselButtonProps>(
  ({ className, children, ...props }, ref) => {
    const { api, canScrollNext } = useCarouselContext()
    return (
      <button
        ref={ref}
        className={cn(baseButtonClass, "right-3", className)}
        disabled={!canScrollNext}
        onClick={(event) => {
          props.onClick?.(event)
          if (event.defaultPrevented) return
          api?.scrollNext()
        }}
        {...props}
      >
        {children ?? (
          <>
            <span className="sr-only">Next slide</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    )
  },
)
CarouselNext.displayName = "CarouselNext"
