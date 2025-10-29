import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { MapPin, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"

interface TeamCardProps extends ComponentProps<"div"> {
  id: string
  name: string
  logoUrl?: string
  location: string
  specialties: string[]
  availableSeats: number
  requirements?: string[]
}

const MAX_VISIBLE_SPECIALTIES = 3

export function TeamCard({
  id,
  name,
  logoUrl,
  location,
  specialties,
  availableSeats,
  requirements,
  className,
  ...props
}: TeamCardProps) {
  return (
    <Link href={`/motorsports/teams/${id}`}>
      <Card
        className={cn(
          "group relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
          className
        )}
        {...props}
      >
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          {logoUrl ? (
            <Image
              alt={name}
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              src={logoUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span className="text-6xl">🏎️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {name}
              </h3>
              <div className="mt-2 flex items-center gap-2 text-muted-foreground text-sm">
                <MapPin className="size-4" />
                <span>{location}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span className="font-semibold">{availableSeats} seats</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {specialties.slice(0, MAX_VISIBLE_SPECIALTIES).map((specialty) => (
                  <Badge key={`specialty-${specialty}`} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
              {requirements && requirements.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Requirements: {requirements.join(", ")}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
