import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"

interface VehicleCardProps extends ComponentProps<"div"> {
  id: string
  image: string
  name: string
  year: number
  make: string
  model: string
  pricePerDay: number
  location: string
  rating?: number
  reviews?: number
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
  rating,
  reviews,
  className,
  ...props
}: VehicleCardProps) {
  return (
    <Link href={`/vehicles/${id}`}>
      <Card
        className={cn(
          "group relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
          className
        )}
        {...props}
      >
        <div className="relative h-64 w-full overflow-hidden">
          <Image
            alt={name}
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute top-3 right-3">
            {rating && (
              <Badge className="bg-white/95 font-semibold shadow-lg" variant="secondary">
                ⭐ {rating}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {year} {make} {model}
              </h3>
              <p className="mt-1 text-muted-foreground">{location}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-3xl">${pricePerDay}</span>
                <span className="text-base text-muted-foreground">/day</span>
              </div>
              {reviews !== undefined && (
                <span className="text-muted-foreground">
                  {reviews} review{reviews !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
