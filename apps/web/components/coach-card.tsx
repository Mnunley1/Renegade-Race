import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { Check, Gauge, MapPin, Monitor, Star, User, Zap } from "lucide-react"
import Link from "next/link"
import type { ComponentProps } from "react"
import Image from "@/components/public-image"

type RacingType = "real-world" | "sim-racing" | "both"

interface CoachCardProps extends ComponentProps<"div"> {
  id: string
  name: string
  avatarUrl?: string
  location: string
  headline?: string
  bio: string
  specialties: string[]
  yearsExperience?: number
  hourlyRate?: number
  halfDayRate?: number
  fullDayRate?: number
  rating?: number
  reviewCount?: number
  verificationStatus?: "pending" | "verified" | "rejected"
  racingType?: RacingType
}

const MAX_BIO_PREVIEW_LENGTH = 90

// Quiet, monochrome chip styling for a refined (non-playful) look
const chipClass =
  "gap-1 border-transparent bg-muted font-normal text-muted-foreground hover:bg-muted"

const RACING_TYPE_META: Record<RacingType, { label: string; icon: typeof Gauge }> = {
  "real-world": { label: "Real-World", icon: Gauge },
  "sim-racing": { label: "Sim Racing", icon: Monitor },
  both: { label: "Real + Sim", icon: Zap },
}

function formatCents(cents?: number) {
  if (cents === undefined) return null
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function startingRateLabel(
  props: Pick<CoachCardProps, "hourlyRate" | "halfDayRate" | "fullDayRate">
) {
  if (props.hourlyRate !== undefined) return `${formatCents(props.hourlyRate)}/hr`
  if (props.halfDayRate !== undefined) return `${formatCents(props.halfDayRate)} half-day`
  if (props.fullDayRate !== undefined) return `${formatCents(props.fullDayRate)} full-day`
  return null
}

export function CoachCard({
  id,
  name,
  avatarUrl,
  location,
  headline,
  bio,
  specialties,
  yearsExperience,
  hourlyRate,
  halfDayRate,
  fullDayRate,
  rating,
  reviewCount,
  verificationStatus,
  racingType,
  className,
  ...props
}: CoachCardProps) {
  const displayText =
    headline ||
    (bio
      ? `${bio.substring(0, MAX_BIO_PREVIEW_LENGTH)}${bio.length > MAX_BIO_PREVIEW_LENGTH ? "..." : ""}`
      : "")

  const rate = startingRateLabel({ hourlyRate, halfDayRate, fullDayRate })
  const isVerified = verificationStatus === "verified"
  const hasReviews = reviewCount !== undefined && reviewCount > 0
  const racing = racingType ? RACING_TYPE_META[racingType] : null

  return (
    <Link className="flex h-full" href={`/coaches/${id}`}>
      <Card
        className={cn(
          "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden border border-border bg-card transition-all duration-300 hover:border-foreground/15 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22)]",
          className
        )}
        {...props}
      >
        <CardContent className="flex flex-1 flex-col p-5">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div className="relative size-28 overflow-hidden rounded-full ring-2 ring-border">
                {avatarUrl && avatarUrl.trim() !== "" ? (
                  <Image alt={name} className="object-cover" fill src={avatarUrl} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <User className="size-14 text-muted-foreground/60" />
                  </div>
                )}
              </div>
              {isVerified && (
                <span
                  className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary ring-2 ring-card"
                  title="Verified coach"
                >
                  <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
                </span>
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
              {hasReviews ? (
                <div className="mt-1.5 flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold text-sm">{(rating ?? 0).toFixed(1)}</span>
                  <span className="text-muted-foreground text-xs">({reviewCount})</span>
                </div>
              ) : (
                <span className="mt-1.5 inline-block font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  New coach
                </span>
              )}
            </div>
          </div>

          {/* Headline / bio */}
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

          {/* Tags */}
          <div className="mt-3 mb-4 flex flex-wrap items-center gap-1.5">
            {racing && (
              <Badge className={chipClass} variant="secondary">
                <racing.icon className="size-3 text-muted-foreground" />
                {racing.label}
              </Badge>
            )}
            {yearsExperience !== undefined && (
              <Badge className={chipClass} variant="secondary">
                {yearsExperience}+ yrs
              </Badge>
            )}
            {specialties.slice(0, 2).map((s) => (
              <Badge className={chipClass} key={s} variant="secondary">
                {s}
              </Badge>
            ))}
            {specialties.length > 2 && (
              <Badge className={chipClass} variant="secondary">
                +{specialties.length - 2}
              </Badge>
            )}
          </div>

          {/* Footer: rate + CTA */}
          <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
            {rate ? (
              <div className="min-w-0">
                <span className="text-muted-foreground text-xs">From </span>
                <span className="font-bold text-foreground text-lg tracking-tight">{rate}</span>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">Contact for rates</span>
            )}
            <Button className="shrink-0" size="sm" tabIndex={-1} variant="outline">
              View Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
