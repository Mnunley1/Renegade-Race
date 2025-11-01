"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"
import { MapPin, Star, Heart, Zap, Gauge } from "lucide-react"
import { useState } from "react"

interface VehicleCardProps extends ComponentProps<"div"> {
  id: string
  image: string
  name: string
  year: number
  make: string
  model: string
  pricePerDay: number
  location: string
  track?: string
  rating?: number
  reviews?: number
  horsepower?: number
  transmission?: string
  drivetrain?: string
}

export function VehicleCard({
  id,
  image,
  name,
  year,
  make,
  model,
  pricePerDay,
  location,
  track,
  rating,
  reviews,
  horsepower,
  transmission,
  className,
  ...props
}: VehicleCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)

  return (
    <Link href={`/vehicles/${id}`} className="block h-full">
      <Card
        className={cn(
          "group relative flex h-full flex-col overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] hover:border-primary/50 hover:shadow-xl cursor-pointer",
          className
        )}
        {...props}
      >
        <div className="relative h-64 w-full shrink-0 overflow-hidden bg-muted">
          <Image
            alt={name}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 z-10 bg-white/90 backdrop-blur-sm hover:bg-white"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsFavorite(!isFavorite)
            }}
          >
            <Heart
              className={cn(
                "size-5 transition-colors",
                isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
              )}
            />
          </Button>

          {/* Quick Specs on Hover */}
          {(horsepower || transmission) && (
            <div className="absolute bottom-0 left-0 right-0 z-10 translate-y-full bg-black/80 p-4 text-white transition-transform group-hover:translate-y-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {horsepower && (
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span className="font-semibold">{horsepower} HP</span>
                  </div>
                )}
                {transmission && (
                  <div className="flex items-center gap-2">
                    <Gauge className="size-4 text-primary" />
                    <span>{transmission}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex flex-1 flex-col space-y-3">
            <div>
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {year} {make} {model}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-3" />
                <span>{location}</span>
              </div>
              <div className="mt-2 min-h-[20px]">
                {rating && (
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-semibold">{rating}</span>
                    {reviews && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({reviews} review{reviews !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between border-t pt-3">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-3xl font-bold text-transparent">
                    ${pricePerDay}
                  </span>
                  <span className="text-sm text-muted-foreground">/day</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
