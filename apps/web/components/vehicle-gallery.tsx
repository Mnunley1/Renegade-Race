"use client"

import { Image } from "@imagekit/next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { Car, ChevronLeft, ChevronRight, X } from "lucide-react"
import { useEffect, useState } from "react"

interface VehicleGalleryProps {
  images: string[]
  vehicleName: string
}

export function VehicleGallery({ images, vehicleName }: VehicleGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const openImage = (index: number) => {
    setSelectedIndex(index)
    setIsOpen(true)
  }

  const closeImage = () => {
    setIsOpen(false)
    setSelectedIndex(null)
  }

  const goToSlide = (index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex(index)
    setTimeout(() => setIsTransitioning(false), 300)
  }

  // Filter out empty image strings
  const validImages = images.filter((img) => img && img.trim() !== "")

  const goToPrevious = () => {
    if (isTransitioning) return
    const newIndex = currentIndex > 0 ? currentIndex - 1 : validImages.length - 1
    goToSlide(newIndex)
  }

  const goToNext = () => {
    if (isTransitioning) return
    const newIndex = currentIndex < validImages.length - 1 ? currentIndex + 1 : 0
    goToSlide(newIndex)
  }

  const goToPreviousModal = () => {
    if (selectedIndex === null) return
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : validImages.length - 1
    setSelectedIndex(newIndex)
  }

  const goToNextModal = () => {
    if (selectedIndex === null) return
    const newIndex = selectedIndex < validImages.length - 1 ? selectedIndex + 1 : 0
    setSelectedIndex(newIndex)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen || selectedIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
        setSelectedIndex(null)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : validImages.length - 1
        setSelectedIndex(newIndex)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const newIndex = selectedIndex < validImages.length - 1 ? selectedIndex + 1 : 0
        setSelectedIndex(newIndex)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, validImages.length])

  // Keyboard navigation for carousel (when modal is not open)
  useEffect(() => {
    if (isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        const newIndex = currentIndex > 0 ? currentIndex - 1 : validImages.length - 1
        setIsTransitioning(true)
        setCurrentIndex(newIndex)
        setTimeout(() => setIsTransitioning(false), 300)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const newIndex = currentIndex < validImages.length - 1 ? currentIndex + 1 : 0
        setIsTransitioning(true)
        setCurrentIndex(newIndex)
        setTimeout(() => setIsTransitioning(false), 300)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex, validImages.length, isTransitioning])

  // Show placeholder when no images are available
  if (validImages.length === 0) {
    return (
      <div className="relative mx-auto mb-8 w-full max-w-5xl">
        <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
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

  return (
    <>
      {/* Carousel Container */}
      <div className="relative mx-auto mb-8 w-full max-w-5xl">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
          {/* Carousel Images */}
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {validImages.map((image, index) => (
              <div
                aria-hidden={index !== currentIndex}
                className="relative min-w-full shrink-0"
                key={index}
              >
                <button
                  aria-label={`View ${vehicleName} image ${index + 1} in full screen`}
                  className="relative size-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onClick={() => openImage(index)}
                  type="button"
                >
                  <Image
                    alt={`${vehicleName} - Image ${index + 1}`}
                    className="size-full object-cover"
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    src={image}
                    urlEndpoint="https://ik.imagekit.io/renegaderace"
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          {validImages.length > 1 && (
            <>
              <Button
                aria-label="Previous image"
                className="-translate-y-1/2 absolute top-1/2 left-4 z-10 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                disabled={isTransitioning}
                onClick={goToPrevious}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                aria-label="Next image"
                className="-translate-y-1/2 absolute top-1/2 right-4 z-10 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                disabled={isTransitioning}
                onClick={goToNext}
                size="icon"
                variant="ghost"
              >
                <ChevronRight className="size-5" />
              </Button>
            </>
          )}

          {/* Dot Indicators */}
          {validImages.length > 1 && (
            <div className="-translate-x-1/2 absolute bottom-4 left-1/2 z-10 flex gap-2">
              {validImages.map((_, index) => (
                <button
                  aria-current={index === currentIndex ? "true" : "false"}
                  aria-label={`Go to image ${index + 1}`}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === currentIndex ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
                  )}
                  key={index}
                  onClick={() => goToSlide(index)}
                  type="button"
                />
              ))}
            </div>
          )}

          {/* Image Counter */}
          {validImages.length > 1 && (
            <div className="absolute top-4 right-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-white backdrop-blur-sm">
              <span className="font-medium text-sm">
                {currentIndex + 1} / {validImages.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Gallery Modal */}
      <Dialog onOpenChange={setIsOpen} open={isOpen}>
        <DialogContent className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 h-[100vh] max-h-[100vh] max-w-[100vw] border-none bg-black/95 p-0 shadow-none data-[state=closed]:animate-out data-[state=open]:animate-in">
          <div className="relative flex h-full flex-col">
            {/* Header with Close Button and Counter */}
            <div className="absolute top-0 right-0 left-0 z-50 flex items-center justify-between p-4">
              {validImages.length > 1 && selectedIndex !== null && (
                <div className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur-sm">
                  <span className="font-medium text-sm">
                    {selectedIndex + 1} / {validImages.length}
                  </span>
                </div>
              )}
              <div className="ml-auto" />
              <Button
                aria-label="Close gallery"
                className="bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                onClick={closeImage}
                size="icon"
                variant="ghost"
              >
                <X className="size-5" />
              </Button>
            </div>

            {/* Main Image Area */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 pb-20">
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

              {/* Previous Button */}
              {validImages.length > 1 && (
                <Button
                  aria-label="Previous image"
                  className="-translate-y-1/2 absolute top-1/2 left-4 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={goToPreviousModal}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronLeft className="size-6" />
                </Button>
              )}

              {/* Next Button */}
              {validImages.length > 1 && (
                <Button
                  aria-label="Next image"
                  className="-translate-y-1/2 absolute top-1/2 right-4 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={goToNextModal}
                  size="icon"
                  variant="ghost"
                >
                  <ChevronRight className="size-6" />
                </Button>
              )}
            </div>

            {/* Thumbnail Strip - No background */}
            {validImages.length > 1 && (
              <div className="absolute right-0 bottom-0 left-0 z-50 pt-2 pb-4">
                <div className="mx-auto flex max-w-5xl justify-center gap-2 overflow-x-auto px-4">
                  {validImages.map((image, index) => (
                    <button
                      aria-label={`Go to image ${index + 1}`}
                      className={cn(
                        "relative size-20 shrink-0 overflow-hidden rounded-md transition-all",
                        selectedIndex === index
                          ? "ring-2 ring-white ring-offset-2"
                          : "opacity-60 hover:opacity-100"
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
