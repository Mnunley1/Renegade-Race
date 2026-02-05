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
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
          className
        )}
        {...props}
      >
        <CardContent className="flex flex-1 flex-col p-4">
          <div className="flex flex-1 flex-col space-y-3">
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 border-primary/20 bg-muted">
                {logoUrl ? (
                  <Image alt={name} className="object-cover" fill src={logoUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-primary">
                    <h3 className="font-bold text-lg text-white">{name.slice(0, 2)}</h3>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-xl transition-colors group-hover:text-primary">
                  {name}
                </h3>
                <div className="mt-1.5 flex items-center gap-2 text-muted-foreground text-sm">
                  <MapPin className="size-4" />
                  <span className="truncate">{location}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm">
                  <Users className="size-4 text-primary" />
                  <span className="font-semibold">{availableSeats} seats</span>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <div className="flex flex-wrap gap-2">
                {specialties.slice(0, MAX_VISIBLE_SPECIALTIES).map((specialty) => (
                  <Badge key={`specialty-${specialty}`} variant="secondary">
                    {specialty}
                  </Badge>
                ))}
                {racingType && <Badge variant="outline">{getRacingTypeLabel(racingType)}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
