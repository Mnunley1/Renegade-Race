import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Award, MapPin, User } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { ComponentProps } from "react"

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
    return "🎮 Sim Racing"
  }
  if (racingType === "both") {
    return "🏎️🎮 Both"
  }
  return "Real-World Racing"
}

const experienceColors = {
  beginner: "bg-green-500/10 text-green-600 dark:text-green-400",
  intermediate: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  advanced: "bg-purple-500/10 text-purple-600 dark:text-purple-600",
  professional: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
}

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
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl",
          className
        )}
        {...props}
      >
        <CardContent className="flex flex-1 flex-col p-4">
          <div className="flex flex-1 flex-col space-y-3">
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border-2 border-primary/20">
                {avatarUrl && avatarUrl.trim() !== "" ? (
                  <Image alt={name} className="object-cover" fill src={avatarUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-primary">
                    <User className="size-12 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-2xl transition-colors group-hover:text-primary">
                  {name}
                </h3>
                <div className="mt-1.5 flex items-center gap-2 text-lg text-muted-foreground">
                  <MapPin className="size-5" />
                  <span className="truncate">{location}</span>
                </div>
              </div>
            </div>

            {displayText && (
              <p
                className={
                  headline
                    ? "font-semibold text-base text-foreground"
                    : "line-clamp-2 text-muted-foreground text-sm leading-relaxed"
                }
              >
                {displayText}
              </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Badge className={experienceColors[experience]}>
                <Award className="mr-1 size-3" />
                {experience.charAt(0).toUpperCase() + experience.slice(1)}
              </Badge>
              <Badge variant="outline">
                {racingType ? getRacingTypeLabel(racingType) : "Real-World Racing"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
