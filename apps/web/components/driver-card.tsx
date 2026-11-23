import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Award, MapPin, User } from "lucide-react"
import Link from "next/link"
import type { ComponentProps } from "react"
import Image from "@/components/public-image"

interface DriverCardProps extends ComponentProps<"div"> {
  id: string
  name: string
  avatarUrl?: string
  location: string
  experience: "beginner" | "intermediate" | "advanced" | "professional"
  racingType?: "real-world" | "sim-racing" | "both"
  simRacingPlatforms?: string[]
  simRacingRating?: string
  licenses: string[]
  preferredCategories: string[]
  headline?: string
  bio: string
}

function getRacingTypeLabel(racingType: "real-world" | "sim-racing" | "both"): string {
  if (racingType === "sim-racing") {
    return "Sim Racing"
  }
  if (racingType === "both") {
    return "Real + Sim"
  }
  return "Real-World"
}

const chipClass =
  "gap-1 border-transparent bg-muted font-normal text-muted-foreground hover:bg-muted"

const MAX_BIO_PREVIEW_LENGTH = 80

export function DriverCard({
  id,
  name,
  avatarUrl,
  location,
  experience,
  racingType,
  headline,
  bio,
  className,
  ...props
}: DriverCardProps) {
  // Use headline if available, otherwise use first part of bio as fallback
  const displayText =
    headline ||
    (bio
      ? `${bio.substring(0, MAX_BIO_PREVIEW_LENGTH)}${bio.length > MAX_BIO_PREVIEW_LENGTH ? "..." : ""}`
      : "")

  return (
    <Link className="flex h-full" href={`/motorsports/drivers/${id}`}>
      <Card
        className={cn(
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:border-foreground/15 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22)]",
          className
        )}
        {...props}
      >
        <CardContent className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col">
            <div className="flex items-start gap-4">
              <div className="relative size-28 shrink-0 overflow-hidden rounded-full ring-2 ring-border">
                {avatarUrl && avatarUrl.trim() !== "" ? (
                  <Image alt={name} className="object-cover" fill src={avatarUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <User className="size-14 text-muted-foreground/60" />
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
              </div>
            </div>

            {displayText && (
              <p
                className={cn(
                  "mt-4",
                  headline
                    ? "font-semibold text-foreground text-sm"
                    : "line-clamp-2 text-muted-foreground text-sm leading-relaxed"
                )}
              >
                {displayText}
              </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
              <Badge className={chipClass} variant="secondary">
                <Award className="size-3 text-muted-foreground" />
                {experience.charAt(0).toUpperCase() + experience.slice(1)}
              </Badge>
              <Badge className={chipClass} variant="secondary">
                {racingType ? getRacingTypeLabel(racingType) : "Real-World"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
