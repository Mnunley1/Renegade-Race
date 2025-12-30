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
  racingType?: "real-world" | "sim-racing" | "both"
  simRacingPlatforms?: string[]
  specialties: string[]
  availableSeats: number
  requirements?: string[]
  contactInfo?: unknown
  description?: unknown
  socialLinks?: unknown
}

const MAX_VISIBLE_SPECIALTIES = 3

function getRacingTypeLabel(racingType: "real-world" | "sim-racing" | "both"): string {
  if (racingType === "sim-racing") {
    return "🎮 Sim Racing"
  }
  if (racingType === "both") {
    return "🏎️🎮 Both"
  }
  return "🏎️ Real-World"
}

export function TeamCard({
  id,
  name,
  logoUrl,
  location,
  racingType,
  simRacingPlatforms,
  specialties,
  availableSeats,
  requirements,
  className,
  contactInfo: _contactInfo,
  description: _description,
  socialLinks: _socialLinks,
  ...props
}: TeamCardProps) {
  return (
    <Link className="flex h-full" href={`/motorsports/teams/${id}`}>
      <Card
        className={cn(
          "group relative flex h-full w-full flex-col overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
          className
        )}
        {...props}
      >
        <div className="relative h-48 w-full flex-shrink-0 overflow-hidden bg-muted">
          {logoUrl ? (
            <Image
              alt={name}
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              src={logoUrl}
            />
          ) : (
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-primary">
              <h3 className="font-bold text-2xl text-white">{name}</h3>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex flex-1 flex-col space-y-4">
            <div>
              <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                {name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  <span>{location}</span>
                </div>
                {racingType && (
                  <Badge className="text-xs" variant="outline">
                    {getRacingTypeLabel(racingType)}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span className="font-semibold">{availableSeats} seats</span>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <div className="flex flex-wrap gap-2">
                {specialties.slice(0, MAX_VISIBLE_SPECIALTIES).map((specialty) => (
                  <Badge key={`specialty-${specialty}`} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
              </div>
              {requirements && requirements.length > 0 && (
                <p className="line-clamp-2 text-muted-foreground text-xs">
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
