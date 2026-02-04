"use client"

import { Image } from "@imagekit/next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { Car, ChevronLeft, ChevronRight, Grid, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

type VehicleGalleryProps = {
  images: string[]
  vehicleName: string
}

export function VehicleGallery({ images, vehicleName }: VehicleGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const validImages = images.filter((img) => img && img.trim() !== "")

  const openGallery = useCallback((index: number) => {
    setSelectedIndex(index)
    setIsOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setIsOpen(false)
    setSelectedIndex(null)
  }, [])

  const goToPrevious = useCallback(() => {
    if (selectedIndex === null) {
      return
    }
    setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : validImages.length - 1)
  }, [selectedIndex, validImages.length])

  const goToNext = useCallback(() => {
    if (selectedIndex === null) {
      return
    }
    setSelectedIndex(selectedIndex < validImages.length - 1 ? selectedIndex + 1 : 0)
  }, [selectedIndex, validImages.length])

  // Keyboard navigation for fullscreen modal
  useEffect(() => {
    if (!isOpen || selectedIndex === null) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeGallery()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goToPrevious()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, closeGallery, goToPrevious, goToNext])

  // No images placeholder
  if (validImages.length === 0) {
    return (
      <div className="relative mb-8 w-full">
        <div
          className={cn(
            "relative flex aspect-[16/9] w-full items-center",
            "justify-center overflow-hidden rounded-xl bg-muted"
          )}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <Car className="size-16 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="font-medium text-lg text-muted-foreground">No images available</p>
              <p className="text-muted-foreground text-sm">{vehicleName}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Single image
  if (validImages.length === 1) {
    return (
      <div className="relative mb-8 w-full">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl">
          <button
            aria-label={`View ${vehicleName} in full screen`}
            className={cn(
              "relative size-full cursor-pointer",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            onClick={() => openGallery(0)}
            type="button"
          >
            <Image
              alt={`${vehicleName}`}
              className="size-full object-cover"
              fill
              priority
              sizes="100vw"
              src={validImages[0] as string}
              urlEndpoint="https://ik.imagekit.io/renegaderace"
            />
          </button>
        </div>
      </div>
    )
  }

  // Multi-image: Airbnb-style hero grid
  const gridImages = validImages.slice(0, 5)
  const remainingCount = validImages.length - 5

  return (
    <>
      {/* Hero Grid */}
      <div className="relative mb-8 w-full">
        <div
          className={cn(
            "grid gap-2 overflow-hidden rounded-xl",
            gridImages.length >= 5
              ? "grid-cols-4 grid-rows-2"
              : gridImages.length >= 3
                ? "grid-cols-3 grid-rows-2"
                : "grid-cols-2"
          )}
          style={{ height: "clamp(300px, 50vw, 520px)" }}
        >
          {/* Main large image */}
          <button
            aria-label={`View ${vehicleName} image 1 in full screen`}
            className={cn(
              "relative overflow-hidden",
              "cursor-pointer transition-opacity hover:opacity-95",
              "focus:outline-none focus:ring-2 focus:ring-ring",
              "focus:ring-inset",
              gridImages.length >= 5
                ? "col-span-2 row-span-2"
                : gridImages.length >= 3
                  ? "col-span-2 row-span-2"
                  : "row-span-1"
            )}
            onClick={() => openGallery(0)}
            type="button"
          >
            <Image
              alt={`${vehicleName} - Main`}
              className="size-full object-cover"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 60vw"
              src={validImages[0] as string}
              urlEndpoint="https://ik.imagekit.io/renegaderace"
            />
          </button>

          {/* Secondary images */}
          {gridImages.slice(1).map((image, index) => {
            const realIndex = index + 1
            const isLast = realIndex === gridImages.length - 1 && remainingCount > 0
            return (
              <button
                aria-label={`View ${vehicleName} image ${realIndex + 1} in full screen`}
                className={cn(
                  "relative overflow-hidden",
                  "cursor-pointer transition-opacity hover:opacity-95",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  "focus:ring-inset"
                )}
                key={realIndex}
                onClick={() => openGallery(realIndex)}
                type="button"
              >
                <Image
                  alt={`${vehicleName} - Image ${realIndex + 1}`}
                  className="size-full object-cover"
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  src={image}
                  urlEndpoint="https://ik.imagekit.io/renegaderace"
                />
                {isLast && (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center",
                      "bg-black/40 backdrop-blur-[2px]"
                    )}
                  >
                    <span className="font-semibold text-lg text-white">+{remainingCount} more</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Show all photos button */}
        {validImages.length > 2 && (
          <Button
            className={cn(
              "absolute right-4 bottom-4",
              "bg-white/90 text-foreground shadow-md backdrop-blur-sm",
              "hover:bg-white"
            )}
            onClick={() => openGallery(0)}
            size="sm"
            variant="outline"
          >
            <Grid className="mr-2 size-4" />
            Show all {validImages.length} photos
          </Button>
        )}
      </div>

      {/* Full Screen Gallery Modal */}
      <Dialog onOpenChange={setIsOpen} open={isOpen}>
        <DialogContent
          className={cn(
            "h-[100dvh] max-h-[100dvh] max-w-[100vw]",
            "border-none bg-black/95 p-0 shadow-none",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=open]:animate-in"
          )}
        >
          <div className="relative flex h-full flex-col">
            {/* Header */}
            <div
              className={cn(
                "absolute top-0 right-0 left-0 z-50",
                "flex items-center justify-between p-4"
              )}
            >
              {validImages.length > 1 && selectedIndex !== null && (
                <div
                  className={cn(
                    "rounded-full bg-black/60 px-4 py-2",
                    "font-medium text-sm text-white backdrop-blur-sm"
                  )}
                >
                  {selectedIndex + 1} / {validImages.length}
                </div>
              )}
              <div className="ml-auto" />
              <Button
                aria-label="Close gallery"
                className={cn(
                  "bg-black/60 text-white backdrop-blur-sm",
                  "hover:bg-black/80",
                  "focus:outline-none focus:ring-2 focus:ring-white"
                )}
                onClick={closeGallery}
                size="icon"
                variant="ghost"
              >
                <X className="size-5" />
              </Button>
            </div>

            {/* Main Image */}
            <div
              className={cn(
                "relative flex flex-1 items-center",
                "justify-center overflow-hidden p-4 pt-16 pb-24"
              )}
            >
              {selectedIndex !== null && validImages[selectedIndex] && (
                <div className="relative size-full max-h-full">
                  <Image
                    alt={`${vehicleName} - Image ${selectedIndex + 1}`}
                    className="size-full object-contain"
                    fill
                    priority
                    sizes="100vw"
                    src={validImages[selectedIndex]}
                    urlEndpoint="https://ik.imagekit.io/renegaderace"
                  />
                </div>
              )}

              {/* Nav buttons */}
              {validImages.length > 1 && (
                <>
                  <Button
                    aria-label="Previous image"
                    className={cn(
                      "absolute top-1/2 left-4 -translate-y-1/2",
                      "size-12 rounded-full bg-black/60 text-white",
                      "backdrop-blur-sm hover:bg-black/80",
                      "focus:outline-none focus:ring-2 focus:ring-white"
                    )}
                    onClick={goToPrevious}
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronLeft className="size-6" />
                  </Button>
                  <Button
                    aria-label="Next image"
                    className={cn(
                      "absolute top-1/2 right-4 -translate-y-1/2",
                      "size-12 rounded-full bg-black/60 text-white",
                      "backdrop-blur-sm hover:bg-black/80",
                      "focus:outline-none focus:ring-2 focus:ring-white"
                    )}
                    onClick={goToNext}
                    size="icon"
                    variant="ghost"
                  >
                    <ChevronRight className="size-6" />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {validImages.length > 1 && (
              <div className={cn("absolute right-0 bottom-0 left-0 z-50", "pt-2 pb-4")}>
                <div
                  className={cn(
                    "mx-auto flex max-w-5xl justify-center",
                    "gap-2 overflow-x-auto px-4"
                  )}
                >
                  {validImages.map((image, index) => (
                    <button
                      aria-label={`Go to image ${index + 1}`}
                      className={cn(
                        "relative size-16 shrink-0 overflow-hidden",
                        "rounded-md transition-all md:size-20",
                        selectedIndex === index
                          ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                          : "opacity-50 hover:opacity-80"
                      )}
                      key={index}
                      onClick={() => setSelectedIndex(index)}
                      type="button"
                    >
                      <Image
                        alt={`Thumbnail ${index + 1}`}
                        className="size-full object-cover"
                        fill
                        sizes="80px"
                        src={image}
                        urlEndpoint="https://ik.imagekit.io/renegaderace"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Swipe hint on mobile */}
            <div
              className={cn(
                "absolute right-0 bottom-20 left-0 z-40",
                "pointer-events-none text-center md:hidden"
              )}
            >
              <span className="text-white/50 text-xs">Use arrows to navigate</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
