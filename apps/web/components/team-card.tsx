import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { MapPin, Users } from "lucide-react"
import Link from "next/link"
import type { ComponentProps } from "react"
import Image from "@/components/public-image"
import { r2Url } from "@/lib/r2-url"

interface TeamCardProps extends ComponentProps<"div"> {
  id: string
  name: string
  logoUrl?: string
  logoR2Key?: string
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

const chipClass = "border-transparent bg-muted font-normal text-muted-foreground hover:bg-muted"

function getRacingTypeLabel(racingType: "real-world" | "sim-racing" | "both"): string {
  if (racingType === "sim-racing") {
    return "Sim Racing"
  }
  if (racingType === "both") {
    return "Real + Sim"
  }
  return "Real-World"
}

export function TeamCard({
  id,
  name,
  logoUrl,
  logoR2Key,
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
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:border-foreground/15 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22)]",
          className
        )}
        {...props}
      >
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col space-y-3">
            <div className="flex items-start gap-4">
              <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                {logoR2Key ? (
                  <Image
                    alt={name}
                    className="object-cover"
                    fill
                    sizes="96px"
                    src={r2Url(logoR2Key) ?? logoUrl}
                    unoptimized={!r2Url(logoR2Key)}
                  />
                ) : logoUrl ? (
                  <Image
                    alt={name}
                    className="size-full object-cover"
                    fill
                    src={logoUrl}
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-primary">
                    <h3 className="font-bold text-lg text-white">{name.slice(0, 2)}</h3>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-lg tracking-tight transition-colors group-hover:text-primary">
                  {name}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-sm">
                  <MapPin className="size-4 shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                  <Users className="size-4 text-primary" />
                  <span className="font-semibold">
                    {availableSeats} open seat{availableSeats === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
              {specialties.slice(0, MAX_VISIBLE_SPECIALTIES).map((specialty) => (
                <Badge className={chipClass} key={`specialty-${specialty}`} variant="secondary">
                  {specialty}
                </Badge>
              ))}
              {racingType && (
                <Badge className={chipClass} variant="secondary">
                  {getRacingTypeLabel(racingType)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
