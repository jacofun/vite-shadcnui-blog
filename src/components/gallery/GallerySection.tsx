import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import type { GalleryImage } from "@/config/config"

type GallerySectionProps = {
  images: GalleryImage[]
}

export function GallerySection({ images }: GallerySectionProps) {
  return (
    <Carousel className="w-full" opts={{ loop: true }}>
      <CarouselContent>
        {images.map((image) => (
          <CarouselItem key={image.src} className="basis-full">
            <figure className="group relative overflow-hidden rounded-3xl bg-black/5">
              <img
                src={`${image.src}?auto=format&fit=crop&w=800&q=80`}
                alt={image.alt}
                loading="lazy"
                className="h-52 w-full object-cover transition duration-500 ease-out group-hover:scale-105"
              />
              {image.description ? (
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-black/0 p-4 text-sm text-white">
                  {image.description}
                </figcaption>
              ) : null}
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex" />
      <CarouselNext className="hidden sm:flex" />
    </Carousel>
  )
}
