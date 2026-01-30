"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowRight, MapPin, Star } from "lucide-react"
import Link from "next/link"

interface RecommendationCardProps {
  type: "team" | "driver"
  id: string
  name: string
  location: string
  matchScore: number
  specialties?: string[]
  experience?: string
  availableSeats?: number
}

export function RecommendationCard({
  type,
  id,
  name,
  location,
  matchScore,
  specialties,
  experience,
  availableSeats,
}: RecommendationCardProps) {
  const detailUrl = type === "team"
    ? `/motorsports/teams/${id}`
    : `/motorsports/drivers/${id}`

  return (
    <div className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="mb-1 text-lg font-semibold">{name}</h3>
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span>{location}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1">
          <Star className="h-4 w-4 fill-primary text-primary" />
          <span className="font-semibold text-primary text-sm">
            {Math.round(matchScore)}%
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Match Score</div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              matchScore >= 80 ? "bg-green-500" :
              matchScore >= 60 ? "bg-blue-500" :
              "bg-orange-500"
            )}
            style={{ width: `${matchScore}%` }}
          />
        </div>
      </div>

      {type === "driver" && experience && (
        <div className="mb-3">
          <span className="text-sm font-medium">Experience: </span>
          <span className="text-muted-foreground text-sm">{experience}</span>
        </div>
      )}

      {type === "team" && availableSeats !== undefined && (
        <div className="mb-3">
          <span className="text-sm font-medium">Available Seats: </span>
          <span className="text-muted-foreground text-sm">{availableSeats}</span>
        </div>
      )}

      {specialties && specialties.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {specialties.slice(0, 3).map((specialty, index) => (
            <span
              key={index}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
            >
              {specialty}
            </span>
          ))}
          {specialties.length > 3 && (
            <span className="text-muted-foreground px-2.5 py-0.5 text-xs">
              +{specialties.length - 3} more
            </span>
          )}
        </div>
      )}

      <Link href={detailUrl}>
        <Button variant="outline" className="w-full">
          View Profile
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  )
}
