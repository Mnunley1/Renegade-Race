"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CancellationPolicy } from "@workspace/ui/components/cancellation-policy"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  AlertTriangle,
  Car,
  Check,
  Clock,
  DollarSign,
  Edit,
  Gauge,
  Heart,
  LogIn,
  MapPin,
  MessageSquare,
  Package,
  Route,
  Share2,
  Shield,
  Star,
  Timer,
  Truck,
  UserPlus,
  Zap,
} from "lucide-react"
import Head from "next/head"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { VehicleGallery } from "@/components/vehicle-gallery"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

// ─── Types ──────────────────────────────────────────────────────────────

type VehicleImage = {
  r2Key?: string
  order?: number
  isPrimary?: boolean
}

type VehicleOwner = {
  _id: string
  name?: string
  profileImage?: string
  memberSince?: string
  totalRentals?: number
  externalId?: string
}

type VehicleTrack = {
  _id: string
  name: string
  location?: string
  description?: string
}

type VehicleAddOn = {
  name: string
  price: number
  description?: string
  isRequired?: boolean
  priceType?: "daily" | "one-time"
}

type VehicleData = {
  _id: Id<"vehicles">
  ownerId: string
  make: string
  model: string
  year: number
  dailyRate: number
  description: string
  horsepower?: number
  transmission?: string
  drivetrain?: string
  engineType?: string
  mileage?: number
  amenities?: string[]
  addOns?: VehicleAddOn[]
  tireType?: string
  experienceLevel?: "beginner" | "intermediate" | "advanced"
  minTripDuration?: string
  maxTripDuration?: string
  advanceNotice?: string
  deliveryAvailable?: boolean
  cancellationPolicy?: "flexible" | "moderate" | "strict"
  isActive: boolean
  images?: VehicleImage[]
  owner?: VehicleOwner
  track?: VehicleTrack
}

type ReviewData = {
  _id: string
  rating: number
  title?: string
  review?: string
  reviewerId: string
  createdAt: number
  updatedAt?: number
  reviewer?: {
    _id?: string
    name?: string
  }
  reservation?: {
    _id: string
  }
}

type ReviewStats = {
  averageRating: number
  totalReviews: number
  ratingBreakdown: Record<number, number>
}

// ─── Sub-components ─────────────────────────────────────────────────────

function SpecCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-5",
        "transition-colors hover:border-primary/30",
        accent ? "border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10" : "bg-card"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            accent ? "bg-primary/15" : "bg-muted"
          )}
        >
          <Icon className={cn("size-5", accent ? "text-primary" : "text-muted-foreground")} />
        </div>
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={cn("font-bold text-2xl tracking-tight", accent && "text-primary")}>{value}</p>
    </div>
  )
}

function RatingBreakdown({ stats }: { stats: ReviewStats }) {
  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = stats.ratingBreakdown[star] ?? 0
        const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
        return (
          <div className="flex items-center gap-3" key={star}>
            <span className="w-3 text-right text-muted-foreground text-sm">{star}</span>
            <Star className="size-3.5 fill-primary text-primary" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full bg-primary transition-all", "duration-500")}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="w-6 text-right text-muted-foreground text-xs">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page Content ──────────────────────────────────────────────────

function VehicleDetailsPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn, user } = useUser()
  const id = params.id as string
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [reviewSort, setReviewSort] = useState<"newest" | "highest" | "lowest">("newest")
  const hasTrackedView = useRef(false)

  // Get date range from URL params
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const vehicle = useQuery(api.vehicles.getById, { id: id as Id<"vehicles"> }) as
    | VehicleData
    | undefined
  const reviews = useQuery(
    api.reviews.getByVehicle,
    id ? { vehicleId: id as Id<"vehicles"> } : "skip"
  ) as ReviewData[] | undefined
  const reviewStats = useQuery(
    api.reviews.getVehicleStats,
    id ? { vehicleId: id as Id<"vehicles"> } : "skip"
  ) as ReviewStats | undefined

  const completedReservation = useQuery(
    api.reservations.getCompletedReservationForVehicle,
    isSignedIn && user?.id && id ? { userId: user.id, vehicleId: id as Id<"vehicles"> } : "skip"
  ) as { _id: string } | null | undefined

  const hasUserReviewed = useMemo(() => {
    if (!(isSignedIn && user?.id && reviews)) {
      return false
    }
    return reviews.some((review: ReviewData) => review.reviewerId === user.id)
  }, [isSignedIn, user?.id, reviews])

  const isFavorite = useQuery(
    api.favorites.isVehicleFavorited,
    isSignedIn && id ? { vehicleId: id as Id<"vehicles"> } : "skip"
  )

  const toggleFavorite = useMutation(api.favorites.toggleFavorite)
  const createConversation = useMutation(api.conversations.create)
  const trackView = useMutation(api.vehicleAnalytics.trackView)
  const trackShare = useMutation(api.vehicleAnalytics.trackShare)

  // Sorted reviews
  const sortedReviews = useMemo(() => {
    if (!reviews) {
      return []
    }
    const sorted = [...reviews]
    if (reviewSort === "newest") {
      sorted.sort((a, b) => b.createdAt - a.createdAt)
    } else if (reviewSort === "highest") {
      sorted.sort((a, b) => b.rating - a.rating)
    } else {
      sorted.sort((a, b) => a.rating - b.rating)
    }
    return sorted
  }, [reviews, reviewSort])

  const handleFavoriteClick = async () => {
    if (!isSignedIn) {
      setShowLoginDialog(true)
      return
    }
    if (isFavorite === undefined || !id) {
      return
    }
    if (!user?.id) {
      setShowLoginDialog(true)
      return
    }
    try {
      await toggleFavorite({
        vehicleId: id as Id<"vehicles">,
      })
      toast.success(
        isFavorite ? "Removed from favorites" : "Added to favorites"
      )
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : ""
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      } else {
        handleErrorWithContext(error, {
          action: "update favorites",
          customMessages: {
            generic: "Failed to update favorites. Please try again.",
          },
        })
      }
    }
  }

  const handleLogin = () => {
    setShowLoginDialog(false)
    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`)
  }

  const handleMessageHost = async () => {
    if (!(isSignedIn && user?.id)) {
      setShowLoginDialog(true)
      return
    }
    if (!vehicle?.ownerId) {
      return
    }
    if (vehicle.ownerId === user.id) {
      return
    }

    setIsCreatingConversation(true)
    try {
      const conversationId = await createConversation({
        vehicleId: vehicle._id,
        renterId: user.id,
        ownerId: vehicle.ownerId,
      })
      router.push(`/messages/${conversationId as string}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : ""
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      } else {
        handleErrorWithContext(error, {
          action: "start conversation",
          customMessages: {
            generic: "Failed to start conversation. Please try again.",
          },
        })
      }
    } finally {
      setIsCreatingConversation(false)
    }
  }

  // Track view on load
  useEffect(() => {
    if (!hasTrackedView.current && vehicle && vehicle.isActive && id) {
      hasTrackedView.current = true
      trackView({ vehicleId: id as Id<"vehicles"> }).catch((error) => {
        handleErrorWithContext(error, { action: "track view" })
      })
    }
  }, [vehicle, id, trackView])

  useEffect(() => {
    hasTrackedView.current = false
  }, [])

  const handleShare = async (platform: string) => {
    if (!(vehicle && id)) {
      return
    }

    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    const text = `Check out this ${title} on Renegade Rentals!`

    try {
      if (platform === "copy_link") {
        await navigator.clipboard.writeText(url)
        toast.success("Link copied to clipboard")
      } else if (platform === "facebook") {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank"
        )
      } else if (platform === "twitter") {
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
          "_blank"
        )
      }
      await trackShare({
        vehicleId: id as Id<"vehicles">,
        platform,
      })
    } catch (error) {
      handleErrorWithContext(error, { action: "share vehicle" })
    }
  }

  // ── Loading state ───────────────────────────────────────────────────
  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div
                className={cn(
                  "size-12 animate-spin rounded-full",
                  "border-4 border-primary border-t-transparent"
                )}
              />
            </div>
            <p className="font-medium text-lg text-muted-foreground">Loading vehicle details...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────
  const images =
    vehicle.images
      ?.slice()
      .sort((a: VehicleImage, b: VehicleImage) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER
        return orderA - orderB
      })
      .filter((img: VehicleImage) => img.r2Key && img.r2Key.trim() !== "")
      .map((img: VehicleImage) => `/${img.r2Key}`) || []

  const host = {
    name: vehicle.owner?.name || "Unknown",
    avatar: vehicle.owner?.profileImage || "",
    memberSince: vehicle.owner?.memberSince || "",
    tripsCompleted: vehicle.owner?.totalRentals || 0,
  }

  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

  const hasSpecs =
    vehicle.horsepower ||
    vehicle.transmission ||
    vehicle.drivetrain ||
    vehicle.engineType ||
    vehicle.mileage ||
    vehicle.tireType

  const hasAddOns = vehicle.addOns && vehicle.addOns.length > 0

  const hasTripRequirements =
    vehicle.experienceLevel ||
    vehicle.minTripDuration ||
    vehicle.maxTripDuration ||
    vehicle.advanceNotice

  const experienceLevelLabel: Record<string, string> = {
    beginner: "Beginner Friendly",
    intermediate: "Intermediate",
    advanced: "Advanced / Pro",
  }

  const cancellationLabels: Record<string, string> = {
    flexible: "Flexible",
    moderate: "Moderate",
    strict: "Strict",
  }

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: vehicleTitle,
    description: vehicle.description,
    offers: {
      "@type": "Offer",
      price: vehicle.dailyRate / 100,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  }

  return (
    <>
      <Head>
        <link href={`https://renegaderentals.com/vehicles/${id}`} rel="canonical" />
      </Head>
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
          type="application/ld+json"
        />

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="mb-2 font-bold text-3xl tracking-tight md:text-4xl">{vehicleTitle}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-4" />
                  <span className="text-sm">
                    {vehicle.track?.location || vehicle.track?.name || "Location TBD"}
                  </span>
                </div>
                {reviewStats && reviewStats.averageRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-primary text-primary" />
                    <span className="font-semibold text-sm">
                      {reviewStats.averageRating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      ({reviewStats.totalReviews})
                    </span>
                  </div>
                )}
                {vehicle.experienceLevel && (
                  <Badge className="text-xs" variant="secondary">
                    {experienceLevelLabel[vehicle.experienceLevel]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Share this listing"
                      onClick={() => handleShare("copy_link")}
                      size="icon"
                      variant="outline"
                    >
                      <Share2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy link</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                aria-label={isFavorite === true ? "Remove from favorites" : "Add to favorites"}
                onClick={handleFavoriteClick}
                size="icon"
                variant="outline"
              >
                <Heart
                  className={cn(
                    "size-4 transition-colors",
                    isFavorite === true ? "fill-red-500 text-red-500" : "text-muted-foreground"
                  )}
                />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Gallery ─────────────────────────────────────────── */}
        <VehicleGallery images={images} vehicleName={vehicleTitle} />

        {/* ── Content Grid ────────────────────────────────────── */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-8 lg:col-span-2">
            {/* Description */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                <Car className="size-5 text-primary" />
                About This Vehicle
              </h2>
              <p className="whitespace-pre-line text-muted-foreground leading-relaxed">
                {vehicle.description}
              </p>
            </section>

            <Separator />

            {/* ── Performance Specs ──────────────────────────── */}
            {hasSpecs && (
              <>
                <section>
                  <h2 className="mb-5 flex items-center gap-2 font-semibold text-xl">
                    <Gauge className="size-5 text-primary" />
                    Performance Specs
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicle.horsepower && (
                      <SpecCard
                        accent
                        icon={Zap}
                        label="Horsepower"
                        value={`${vehicle.horsepower.toLocaleString()} hp`}
                      />
                    )}
                    {vehicle.engineType && (
                      <SpecCard icon={Gauge} label="Engine" value={vehicle.engineType} />
                    )}
                    {vehicle.transmission && (
                      <SpecCard icon={Car} label="Transmission" value={vehicle.transmission} />
                    )}
                    {vehicle.drivetrain && (
                      <SpecCard icon={Route} label="Drivetrain" value={vehicle.drivetrain} />
                    )}
                    {vehicle.tireType && (
                      <SpecCard icon={Car} label="Tire Type" value={vehicle.tireType} />
                    )}
                    {vehicle.mileage && (
                      <SpecCard
                        icon={Route}
                        label="Mileage"
                        value={`${vehicle.mileage.toLocaleString()} mi`}
                      />
                    )}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ── Amenities ─────────────────────────────────── */}
            {vehicle.amenities && vehicle.amenities.length > 0 && (
              <>
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                    <Check className="size-5 text-primary" />
                    Amenities & Features
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {vehicle.amenities.map((amenity: string) => (
                      <div className="flex items-center gap-2.5" key={amenity}>
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center",
                            "justify-center rounded-full bg-primary/10"
                          )}
                        >
                          <Check className="size-3.5 text-primary" />
                        </div>
                        <span className="text-sm">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ── Add-ons ───────────────────────────────────── */}
            {hasAddOns && (
              <>
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                    <Package className="size-5 text-primary" />
                    Available Add-ons
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {vehicle.addOns?.map((addOn: VehicleAddOn) => (
                      <div
                        className={cn(
                          "flex items-start justify-between gap-3",
                          "rounded-xl border p-4",
                          addOn.isRequired && "border-primary/20 bg-primary/5"
                        )}
                        key={addOn.name}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{addOn.name}</p>
                            {addOn.isRequired && (
                              <Badge className="text-[10px]" variant="secondary">
                                Required
                              </Badge>
                            )}
                          </div>
                          {addOn.description && (
                            <p className="mt-1 text-muted-foreground text-xs">
                              {addOn.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-sm">${(addOn.price / 100).toFixed(0)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {addOn.priceType === "daily" ? "per day" : "one-time"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ── Trip Requirements ─────────────────────────── */}
            {hasTripRequirements && (
              <>
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                    <AlertTriangle className="size-5 text-primary" />
                    Trip Requirements
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {vehicle.experienceLevel && (
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center",
                            "justify-center rounded-lg bg-primary/10"
                          )}
                        >
                          <Shield className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Experience Level
                          </p>
                          <p className="font-semibold">
                            {experienceLevelLabel[vehicle.experienceLevel]}
                          </p>
                        </div>
                      </div>
                    )}
                    {vehicle.minTripDuration && (
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center",
                            "justify-center rounded-lg bg-primary/10"
                          )}
                        >
                          <Timer className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Minimum Duration
                          </p>
                          <p className="font-semibold">{vehicle.minTripDuration}</p>
                        </div>
                      </div>
                    )}
                    {vehicle.maxTripDuration && (
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center",
                            "justify-center rounded-lg bg-primary/10"
                          )}
                        >
                          <Timer className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Maximum Duration
                          </p>
                          <p className="font-semibold">{vehicle.maxTripDuration}</p>
                        </div>
                      </div>
                    )}
                    {vehicle.advanceNotice && (
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center",
                            "justify-center rounded-lg bg-primary/10"
                          )}
                        >
                          <Clock className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Advance Notice
                          </p>
                          <p className="font-semibold">{vehicle.advanceNotice}</p>
                        </div>
                      </div>
                    )}
                    {vehicle.deliveryAvailable && (
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex size-10 shrink-0 items-center",
                            "justify-center rounded-lg bg-primary/10"
                          )}
                        >
                          <Truck className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                            Delivery
                          </p>
                          <p className="font-semibold">Available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ── Track Information ──────────────────────────── */}
            {vehicle.track && (
              <>
                <section>
                  <h2 className="mb-4 flex items-center gap-2 font-semibold text-xl">
                    <Route className="size-5 text-primary" />
                    Track Information
                  </h2>
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">{vehicle.track.name}</h3>
                    {vehicle.track.description && (
                      <p className="text-muted-foreground leading-relaxed">
                        {vehicle.track.description}
                      </p>
                    )}
                    {vehicle.track.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="size-4" />
                        <span className="text-sm">{vehicle.track.location}</span>
                      </div>
                    )}
                  </div>
                </section>
                <Separator />
              </>
            )}


            {/* ── Reviews ───────────────────────────────────── */}
            <section>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-xl">
                  <Star className="size-5 text-primary" />
                  Reviews
                  {reviewStats && reviewStats.totalReviews > 0 && (
                    <span className="ml-1 font-normal text-base text-muted-foreground">
                      ({reviewStats.totalReviews})
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  {reviews && reviews.length > 1 && (
                    <div className="flex gap-1">
                      {(
                        [
                          { key: "newest", label: "Newest" },
                          { key: "highest", label: "Highest" },
                          { key: "lowest", label: "Lowest" },
                        ] as const
                      ).map(({ key, label }) => (
                        <Button
                          className={cn(
                            "h-8 text-xs",
                            reviewSort === key && "bg-primary/10 text-primary"
                          )}
                          key={key}
                          onClick={() => setReviewSort(key)}
                          size="sm"
                          variant={reviewSort === key ? "secondary" : "ghost"}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  )}
                  {completedReservation && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/trips/review/${completedReservation._id}`}>
                        <Star className="mr-1.5 size-3.5" />
                        {hasUserReviewed ? "Edit Review" : "Write Review"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Rating summary + breakdown */}
              {reviewStats && reviewStats.totalReviews > 0 && (
                <div
                  className={cn(
                    "mb-6 flex flex-col gap-6 rounded-xl border p-5",
                    "sm:flex-row sm:items-center"
                  )}
                >
                  <div className="text-center sm:border-r sm:pr-6">
                    <div className="font-bold text-5xl tracking-tight">
                      {reviewStats.averageRating.toFixed(1)}
                    </div>
                    <div className="mt-1 flex justify-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          className={cn(
                            "size-4",
                            i < Math.round(reviewStats.averageRating)
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30"
                          )}
                          key={i}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {reviewStats.totalReviews} review
                      {reviewStats.totalReviews !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex-1">
                    <RatingBreakdown stats={reviewStats} />
                  </div>
                </div>
              )}

              {/* Review list */}
              {sortedReviews.length > 0 ? (
                <div className="space-y-4">
                  {sortedReviews.map((review: ReviewData) => {
                    const isUserReview = review.reviewerId === user?.id
                    return (
                      <div
                        className={cn(
                          "rounded-xl border p-5",
                          "transition-colors hover:bg-muted/30"
                        )}
                        key={review._id}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              {review.reviewer?._id ? (
                                <Link
                                  className={cn(
                                    "font-semibold text-sm",
                                    "transition-colors hover:text-primary"
                                  )}
                                  href={`/r/${review.reviewer._id}`}
                                >
                                  {review.reviewer?.name || "Anonymous"}
                                </Link>
                              ) : (
                                <p className="font-semibold text-sm">
                                  {review.reviewer?.name || "Anonymous"}
                                </p>
                              )}
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    className={cn(
                                      "size-3.5",
                                      i < review.rating
                                        ? "fill-primary text-primary"
                                        : "text-muted-foreground/30"
                                    )}
                                    key={i}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {new Date(review.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                              {review.updatedAt && review.updatedAt !== review.createdAt && (
                                <span className="ml-1.5">(edited)</span>
                              )}
                            </p>
                          </div>
                          {isUserReview && review.reservation && (
                            <Link href={`/trips/review/${review.reservation._id}`}>
                              <Button className="gap-1.5" size="sm" variant="ghost">
                                <Edit className="size-3.5" />
                                Edit
                              </Button>
                            </Link>
                          )}
                        </div>
                        {review.title && <p className="mb-2 font-semibold">{review.title}</p>}
                        {review.review && (
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {review.review}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Star className="mx-auto mb-4 size-12 text-muted-foreground/20" />
                  <p className="mb-2 font-semibold text-lg">No reviews yet</p>
                  <p className="mb-4 text-muted-foreground text-sm">
                    {completedReservation
                      ? "Share your experience with this vehicle!"
                      : "Be the first to review this vehicle!"}
                  </p>
                  {completedReservation && (
                    <Button asChild variant="outline">
                      <Link href={`/trips/review/${completedReservation._id}`}>
                        <Star className="mr-2 size-4" />
                        {hasUserReviewed ? "Edit Review" : "Write Review"}
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-5">
              {/* Booking card */}
              <Card className="overflow-hidden border-2 shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-5 flex items-baseline gap-1">
                    <span
                      className={cn(
                        "bg-gradient-to-r from-primary to-primary/70",
                        "bg-clip-text font-bold text-3xl text-transparent"
                      )}
                    >
                      ${vehicle.dailyRate.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm">/day</span>
                  </div>

                  {/* Quick info */}
                  <div className="mb-5 space-y-3">
                    {vehicle.minTripDuration && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Timer className="size-4 shrink-0" />
                        <span>Min: {vehicle.minTripDuration}</span>
                      </div>
                    )}
                    {vehicle.experienceLevel && (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Shield className="size-4 shrink-0" />
                        <span>{experienceLevelLabel[vehicle.experienceLevel]}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <DollarSign className="size-4 shrink-0" />
                      <span>
                        {vehicle.cancellationPolicy
                          ? `${cancellationLabels[vehicle.cancellationPolicy]} cancellation`
                          : "Standard cancellation"}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="mb-3 w-full text-base"
                    onClick={() => {
                      const checkoutUrl =
                        startDate && endDate
                          ? `/checkout?vehicleId=${vehicle._id}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
                          : `/checkout?vehicleId=${vehicle._id}`
                      router.push(checkoutUrl)
                    }}
                    size="lg"
                  >
                    Reserve Now
                  </Button>
                  <p className="text-center text-muted-foreground text-xs">
                    You won&apos;t be charged until checkout
                  </p>
                </CardContent>
              </Card>

              {/* Host card */}
              <Card>
                <CardContent className="p-5">
                  <Link className="block" href={`/r/${vehicle.owner?._id}`}>
                    <div
                      className={cn(
                        "flex items-center gap-4",
                        "transition-opacity hover:opacity-80"
                      )}
                    >
                      <Avatar className="size-14">
                        <AvatarImage src={host.avatar} />
                        <AvatarFallback>{host.name[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{host.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {host.memberSince && `Member since ${host.memberSince}`}
                          {host.memberSince && host.tripsCompleted > 0 && " \u00B7 "}
                          {host.tripsCompleted > 0 && `${host.tripsCompleted} trips`}
                          {!host.memberSince && host.tripsCompleted === 0 && "New member"}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {vehicle.ownerId !== user?.id && (
                    <>
                      <Separator className="my-4" />
                      <Button
                        className="w-full"
                        disabled={isCreatingConversation}
                        onClick={handleMessageHost}
                        variant="outline"
                      >
                        <MessageSquare className="mr-2 size-4" />
                        {isCreatingConversation ? "Loading..." : "Message Host"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Cancellation Policy */}
              <CancellationPolicy variant="full" />
            </div>
          </div>
        </div>

        {/* ── Mobile sticky footer ────────────────────────────── */}
        <div
          className={cn(
            "fixed right-0 bottom-0 left-0 z-40",
            "border-t bg-background/95 px-4 py-3 backdrop-blur-sm",
            "lg:hidden"
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-bold text-lg">${vehicle.dailyRate.toLocaleString()}</span>
              <span className="text-muted-foreground text-sm"> /day</span>
            </div>
            <Button
              onClick={() => {
                const checkoutUrl =
                  startDate && endDate
                    ? `/checkout?vehicleId=${vehicle._id}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
                    : `/checkout?vehicleId=${vehicle._id}`
                router.push(checkoutUrl)
              }}
              size="lg"
            >
              Reserve Now
            </Button>
          </div>
        </div>
        {/* Spacer for mobile sticky footer */}
        <div className="h-20 lg:hidden" />

        {/* ── Login Dialog ────────────────────────────────────── */}
        <Dialog onOpenChange={setShowLoginDialog} open={showLoginDialog}>
          <DialogContent
            className={cn(
              "border-0 bg-white/95 p-0 shadow-2xl",
              "backdrop-blur sm:max-w-md dark:bg-gray-900/95"
            )}
          >
            <Card className="border-0 shadow-none">
              <CardContent className="p-8">
                <div className="mb-6 text-center">
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <Car className="size-8 text-[#EF1C25]" />
                    <span className="font-bold text-2xl text-foreground">Renegade Rentals</span>
                  </div>
                  <h2 className="mb-2 font-bold text-2xl text-foreground">Sign In Required</h2>
                  <p className="text-muted-foreground">
                    Please sign in to save your favorite vehicles and access them anytime.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    className={cn("w-full bg-[#EF1C25] text-white", "hover:bg-[#EF1C25]/90")}
                    onClick={handleLogin}
                    size="lg"
                  >
                    <LogIn className="mr-2 size-4" />
                    Sign In
                  </Button>
                  <Button
                    className="w-full border-border hover:bg-muted"
                    onClick={() => {
                      setShowLoginDialog(false)
                      router.push("/sign-up")
                    }}
                    size="lg"
                    variant="outline"
                  >
                    <UserPlus className="mr-2 size-4" />
                    Create Account
                  </Button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Join thousands of racing enthusiasts
                  </p>
                </div>
              </CardContent>
            </Card>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

export default function VehicleDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Loading vehicle details...</p>
            </div>
          </div>
        </div>
      }
    >
      <VehicleDetailsPageContent />
    </Suspense>
  )
}
