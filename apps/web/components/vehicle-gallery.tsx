"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

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

  const goToPrevious = () => {
    if (isTransitioning) return
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    goToSlide(newIndex)
  }

  const goToNext = () => {
    if (isTransitioning) return
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    goToSlide(newIndex)
  }

  const goToPreviousModal = () => {
    if (selectedIndex === null) return
    const newIndex = selectedIndex > 0 ? selectedIndex - 1 : images.length - 1
    setSelectedIndex(newIndex)
  }

  const goToNextModal = () => {
    if (selectedIndex === null) return
    const newIndex = selectedIndex < images.length - 1 ? selectedIndex + 1 : 0
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
        const newIndex = selectedIndex > 0 ? selectedIndex - 1 : images.length - 1
        setSelectedIndex(newIndex)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const newIndex = selectedIndex < images.length - 1 ? selectedIndex + 1 : 0
        setSelectedIndex(newIndex)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, images.length])

  // Keyboard navigation for carousel (when modal is not open)
  useEffect(() => {
    if (isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
        setIsTransitioning(true)
        setCurrentIndex(newIndex)
        setTimeout(() => setIsTransitioning(false), 300)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
        setIsTransitioning(true)
        setCurrentIndex(newIndex)
        setTimeout(() => setIsTransitioning(false), 300)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, currentIndex, images.length, isTransitioning])

  if (images.length === 0) return null

  return (
    <>
      {/* Carousel Container */}
      <div className="relative mb-8 mx-auto w-full max-w-5xl">
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-muted">
          {/* Carousel Images */}
          <div
            className="flex h-full transition-transform duration-300 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {images.map((image, index) => (
              <div
                key={index}
                className="relative min-w-full shrink-0"
                aria-hidden={index !== currentIndex}
              >
                <button
                  type="button"
                  onClick={() => openImage(index)}
                  className="relative size-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={`View ${vehicleName} image ${index + 1} in full screen`}
                >
                  <Image
                    alt={`${vehicleName} - Image ${index + 1}`}
                    className="size-full object-cover"
                    fill
                    sizes="100vw"
                    src={image}
                    priority={index === 0}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                onClick={goToPrevious}
                aria-label="Previous image"
                disabled={isTransitioning}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                onClick={goToNext}
                aria-label="Next image"
                disabled={isTransitioning}
              >
                <ChevronRight className="size-5" />
              </Button>
            </>
          )}

          {/* Dot Indicators */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === currentIndex
                      ? "w-8 bg-white"
                      : "w-2 bg-white/50 hover:bg-white/75"
                  )}
                  aria-label={`Go to image ${index + 1}`}
                  aria-current={index === currentIndex ? "true" : "false"}
                />
              ))}
            </div>
          )}

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1.5 text-white backdrop-blur-sm">
              <span className="text-sm font-medium">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Full Screen Gallery Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-w-[100vw] h-[100vh] max-h-[100vh] border-none bg-black/95 p-0 shadow-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <div className="relative flex h-full flex-col">
            {/* Header with Close Button and Counter */}
            <div className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between p-4">
              {images.length > 1 && selectedIndex !== null && (
                <div className="rounded-full bg-black/50 px-4 py-2 text-white backdrop-blur-sm">
                  <span className="text-sm font-medium">
                    {selectedIndex + 1} / {images.length}
                  </span>
                </div>
              )}
              <div className="ml-auto" />
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                onClick={closeImage}
                aria-label="Close gallery"
              >
                <X className="size-5" />
              </Button>
            </div>

            {/* Main Image Area */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 pb-20">
              {selectedIndex !== null && (
                <div className="relative size-full max-h-full">
                  <Image
                    alt={`${vehicleName} - Image ${selectedIndex + 1}`}
                    className="size-full object-contain"
                    fill
                    sizes="100vw"
                    src={images[selectedIndex]}
                    priority
                  />
                </div>
              )}

              {/* Previous Button */}
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={goToPreviousModal}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-6" />
                </Button>
              )}

              {/* Next Button */}
              {images.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  onClick={goToNextModal}
                  aria-label="Next image"
                >
                  <ChevronRight className="size-6" />
                </Button>
              )}
            </div>

            {/* Thumbnail Strip - No background */}
            {images.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 z-50 pb-4 pt-2">
                <div className="mx-auto flex max-w-5xl justify-center gap-2 overflow-x-auto px-4">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        "relative size-20 shrink-0 overflow-hidden rounded-md transition-all",
                        selectedIndex === index
                          ? "ring-2 ring-white ring-offset-2"
                          : "opacity-60 hover:opacity-100"
                      )}
                      aria-label={`Go to image ${index + 1}`}
                    >
                      <Image
                        alt={`Thumbnail ${index + 1}`}
                        className="size-full object-cover"
                        fill
                        sizes="80px"
                        src={image}
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

