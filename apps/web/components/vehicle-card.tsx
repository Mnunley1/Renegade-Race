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
        className={cn("group overflow-hidden transition-all hover:shadow-lg", className)}
        {...props}
      >
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            alt={name}
            className="object-cover transition-transform group-hover:scale-105"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            src={image}
          />
          <div className="absolute top-2 right-2">
            {rating && (
              <Badge className="bg-white/90" variant="secondary">
                ⭐ {rating}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div>
              <h3 className="font-semibold text-lg">
                {year} {make} {model}
              </h3>
              <p className="text-muted-foreground text-sm">{location}</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-2xl">${pricePerDay}</span>
                <span className="text-muted-foreground text-sm">/day</span>
              </div>
              {reviews !== undefined && (
                <span className="text-muted-foreground text-sm">
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
