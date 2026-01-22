"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import {
  Award,
  Calendar,
  Car,
  Check,
  ChevronRight,
  Flag,
  Loader2,
  MapPin,
  Shield,
  Star,
  Trophy,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"
import type { Id } from "@/lib/convex"

// Time constants
const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const DAYS_PER_MONTH = 30
const DAYS_PER_YEAR = 365
const MS_PER_DAY = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY

// Rating thresholds
const RATING_ONE = 1
const RATING_TWO = 2
const RATING_THREE = 3
const RATING_FOUR = 4
const RATING_FIVE = 5
const STAR_RATINGS = [RATING_ONE, RATING_TWO, RATING_THREE, RATING_FOUR, RATING_FIVE] as const
const ALL_STAR_HOST_MIN_RATING = 4.5
const ALL_STAR_HOST_MIN_TRIPS = 10
const SUPER_HOST_MIN_RATING = 4.8
const SUPER_HOST_MIN_TRIPS = 25
const PERCENTAGE_MULTIPLIER = 100

// Helper function to format date
function formatDate(dateString: string | number) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number) {
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / MS_PER_DAY)
  const months = Math.floor(days / DAYS_PER_MONTH)
  const years = Math.floor(days / DAYS_PER_YEAR)

  if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""} ago`
  }
  if (months > 0) {
    return `${months} month${months > 1 ? "s" : ""} ago`
  }
  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ago`
  }
  return "Recently"
}

// Star rating component
function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "size-3.5",
    md: "size-4",
    lg: "size-5",
  }

  return (
    <div className="flex items-center gap-0.5">
      {STAR_RATINGS.map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClasses[size],
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  )
}

// Rating bar component for breakdown
function RatingBar({ rating, count, total }: { rating: number; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * PERCENTAGE_MULTIPLIER : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-3 text-muted-foreground text-sm">{rating}</span>
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted-foreground text-sm">{count}</span>
    </div>
  )
}

// Types for components
type UserData = {
  _id?: Id<"users">
  name?: string
  profileImage?: string
  location?: string
  bio?: string
  memberSince?: string
  totalRentals?: number
  rating?: number
  experience?: string
  interests?: string[]
  externalId?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
}

type ReviewStats = {
  averageRating: number
  totalReviews: number
  ratingBreakdown?: Record<number, number>
}

type VehicleData = {
  id: string
  image: string
  imageKey?: string // R2 key for ImageKit - preferred over image URL
  name: string
  year: number
  make: string
  model: string
  pricePerDay: number
  location: string
  track: string
  rating: number
  reviews: number
  horsepower?: number
  transmission: string
  drivetrain?: string
}

// Hero section component
function ProfileHero({
  user,
  userRating,
  totalReviews,
  totalRentals,
  vehicleCount,
  memberSinceDate,
  isSuperHost,
  isAllStarHost,
  isVerified,
}: {
  user: UserData
  userRating: number
  totalReviews: number
  totalRentals: number
  vehicleCount: number
  memberSinceDate: string | null
  isSuperHost: boolean
  isAllStarHost: boolean
  isVerified: boolean
}) {
  const userInitials = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
  const bioText = user.bio || ""

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      <div className="container relative mx-auto max-w-7xl px-4 py-12">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
          {/* Profile Image & Quick Stats */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="size-36 shadow-2xl ring-4 ring-background md:size-44">
                <AvatarImage alt={user.name || "User"} src={user.profileImage} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-4xl text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {userRating > 0 && (
                <div className="-translate-x-1/2 absolute -bottom-2 left-1/2 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 shadow-lg dark:bg-gray-900">
                  <Star className="size-5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-lg">{userRating.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Quick Stats - Mobile */}
            <div className="flex gap-6 md:hidden">
              <div className="text-center">
                <p className="font-bold text-2xl">{totalReviews}</p>
                <p className="text-muted-foreground text-sm">Reviews</p>
              </div>
              <Separator className="h-12" orientation="vertical" />
              <div className="text-center">
                <p className="font-bold text-2xl">{vehicleCount}</p>
                <p className="text-muted-foreground text-sm">Vehicles</p>
              </div>
              <Separator className="h-12" orientation="vertical" />
              <div className="text-center">
                <p className="font-bold text-2xl">{totalRentals}</p>
                <p className="text-muted-foreground text-sm">Rentals</p>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="mb-4 flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-4">
              <h1 className="font-bold text-3xl md:text-4xl">{user.name || "User"}</h1>
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                {isSuperHost && (
                  <Badge className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600">
                    <Trophy className="size-3.5" />
                    Super Host
                  </Badge>
                )}
                {isAllStarHost && !isSuperHost && (
                  <Badge className="gap-1.5 bg-primary text-primary-foreground">
                    <Award className="size-3.5" />
                    All-Star Host
                  </Badge>
                )}
                {isVerified && (
                  <Badge className="gap-1.5" variant="secondary">
                    <Shield className="size-3.5" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>

            {/* Location & Member Info */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-4 text-muted-foreground md:justify-start">
              {user.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {user.location}
                </span>
              )}
              {memberSinceDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  Joined {memberSinceDate}
                </span>
              )}
            </div>

            {bioText && (
              <p className="mb-6 max-w-2xl text-muted-foreground leading-relaxed">{bioText}</p>
            )}

            {/* Quick Stats - Desktop */}
            <div className="hidden gap-8 md:flex">
              <div className="text-center">
                <p className="font-bold text-3xl">{totalReviews}</p>
                <p className="text-muted-foreground text-sm">Reviews</p>
              </div>
              <Separator className="h-16" orientation="vertical" />
              <div className="text-center">
                <p className="font-bold text-3xl">{vehicleCount}</p>
                <p className="text-muted-foreground text-sm">Vehicles</p>
              </div>
              <Separator className="h-16" orientation="vertical" />
              <div className="text-center">
                <p className="font-bold text-3xl">{totalRentals}</p>
                <p className="text-muted-foreground text-sm">Completed Rentals</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sidebar component
function ProfileSidebar({
  user,
  firstName,
  userRating,
  totalReviews,
  totalRentals,
  reviewStats,
  isSuperHost,
  isAllStarHost,
}: {
  user: UserData
  firstName: string
  userRating: number
  totalReviews: number
  totalRentals: number
  reviewStats: ReviewStats | null | undefined
  isSuperHost: boolean
  isAllStarHost: boolean
}) {
  return (
    <div className="space-y-6 lg:col-span-1">
      {/* About Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg">
            <Users className="size-5 text-primary" />
            About {firstName}
          </h3>
          <div className="space-y-4">
            {/* Experience Level */}
            {user.experience && (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Flag className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{user.experience}</p>
                  <p className="text-muted-foreground text-xs">Experience Level</p>
                </div>
              </div>
            )}

            {/* Location */}
            {user.location && (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MapPin className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{user.location}</p>
                  <p className="text-muted-foreground text-xs">Location</p>
                </div>
              </div>
            )}

            {/* Member Since */}
            {user.memberSince && (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {new Date(user.memberSince).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-muted-foreground text-xs">Member Since</p>
                </div>
              </div>
            )}

            {/* Verified Badge */}
            {user.isEmailVerified && (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                  <Check className="size-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Verified Member</p>
                  <p className="text-muted-foreground text-xs">Identity confirmed</p>
                </div>
              </div>
            )}
          </div>

          {/* Interests/Specialties */}
          {user.interests && user.interests.length > 0 && (
            <div className="mt-5 border-t pt-5">
              <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Interests
              </p>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <Badge key={interest} className="text-xs" variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rating Breakdown Card */}
      {totalReviews > 0 && reviewStats && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg">
              <Star className="size-5 text-amber-400" />
              Rating Breakdown
            </h3>
            <div className="mb-4 flex items-center gap-4">
              <div className="text-center">
                <p className="font-bold text-4xl">{userRating.toFixed(1)}</p>
                <StarRating rating={userRating} size="md" />
                <p className="mt-1 text-muted-foreground text-sm">{totalReviews} reviews</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              {[...STAR_RATINGS].reverse().map((rating) => (
                <RatingBar
                  key={rating}
                  count={reviewStats.ratingBreakdown?.[rating] || 0}
                  rating={rating}
                  total={totalReviews}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Host Highlights */}
      {(isAllStarHost || isSuperHost) && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-lg">
              <Trophy className="size-5 text-primary" />
              Host Highlights
            </h3>
            <div className="space-y-4">
              {isSuperHost && (
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500">
                    <Trophy className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">Super Host</p>
                    <p className="text-muted-foreground text-sm">
                      One of our highest-rated and most experienced hosts with 25+ rentals
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Flag className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Experienced Host</p>
                  <p className="text-muted-foreground text-sm">
                    {totalRentals}+ successful rentals completed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// Review card component
type ReviewData = {
  _id: string
  rating: number
  title?: string
  review: string
  createdAt: number
  vehicleId: string
  reviewer?: { name?: string; profileImage?: string }
  vehicle?: { year: number; make: string; model: string }
  response?: { text: string }
}

function ReviewCard({ review, firstName }: { review: ReviewData; firstName: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-12">
            <AvatarImage
              alt={review.reviewer?.name || "Reviewer"}
              src={review.reviewer?.profileImage}
            />
            <AvatarFallback>{review.reviewer?.name?.[0]?.toUpperCase() || "R"}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="font-semibold">{review.reviewer?.name || "Guest"}</p>
                <p className="text-muted-foreground text-sm">
                  {formatRelativeTime(review.createdAt)}
                </p>
              </div>
              <StarRating rating={review.rating} size="sm" />
            </div>
            {review.title && <h4 className="mb-2 font-medium">{review.title}</h4>}
            <p className="text-muted-foreground leading-relaxed">{review.review}</p>
            {review.vehicle && (
              <Link
                className="mt-3 flex items-center gap-2 text-primary text-sm hover:underline"
                href={`/vehicles/${review.vehicleId}`}
              >
                <Car className="size-4" />
                {review.vehicle.year} {review.vehicle.make} {review.vehicle.model}
                <ChevronRight className="size-4" />
              </Link>
            )}
            {review.response && (
              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <p className="mb-2 font-medium text-sm">Response from {firstName}</p>
                <p className="text-muted-foreground text-sm">{review.response.text}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main page component
export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const convexUserId = params.id as Id<"users"> // Convex document ID from URL
  const [activeTab, setActiveTab] = useState("vehicles")

  // Fetch user by Convex document ID
  const user = useQuery(api.users.getById, convexUserId ? { userId: convexUserId } : "skip")

  // Use externalId (Clerk ID) for fetching related data (vehicles, reviews)
  const externalId = user?.externalId

  // Fetch vehicles and review stats using the externalId
  const vehicles = useQuery(api.vehicles.getByOwner, externalId ? { ownerId: externalId } : "skip")
  const reviewStats = useQuery(
    api.reviews.getUserStats,
    externalId ? { userId: externalId } : "skip"
  )
  const reviews = useQuery(
    api.reviews.getByUser,
    externalId ? { userId: externalId, role: "reviewed" } : "skip"
  )

  // Fetch vehicle stats for user's vehicles
  const userVehicleIds = useMemo(() => {
    if (!vehicles) {
      return []
    }
    return vehicles.map((v) => v._id as Id<"vehicles">)
  }, [vehicles])

  const userVehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    userVehicleIds.length > 0 ? { vehicleIds: userVehicleIds } : "skip"
  )

  // Map vehicles to the format expected by VehicleCard
  const mappedVehicles: VehicleData[] = useMemo(() => {
    if (!vehicles) {
      return []
    }
    return vehicles.map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
      const stats = userVehicleStats?.[vehicle._id]
      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl ?? "",
        imageKey: primaryImage?.r2Key, // Pass R2 key for ImageKit optimization
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        pricePerDay: vehicle.dailyRate,
        location: vehicle.track?.location || "",
        track: vehicle.track?.name || "",
        rating: stats?.averageRating || 0,
        reviews: stats?.totalReviews || 0,
        horsepower: vehicle.horsepower,
        transmission: vehicle.transmission || "",
        drivetrain: vehicle.drivetrain || "",
      }
    })
  }, [vehicles, userVehicleStats])

  // Get rating from review stats or user rating
  const userRating = reviewStats?.averageRating || user?.rating || 0
  const totalReviews = reviewStats?.totalReviews || 0
  const totalRentals = user?.totalRentals || 0
  const memberSinceDate = user?.memberSince ? formatDate(user.memberSince) : null

  // Determine badges
  const isAllStarHost =
    userRating >= ALL_STAR_HOST_MIN_RATING && totalRentals >= ALL_STAR_HOST_MIN_TRIPS
  const isVerified = !!user?.isEmailVerified
  const isSuperHost = userRating >= SUPER_HOST_MIN_RATING && totalRentals >= SUPER_HOST_MIN_TRIPS

  // Show loading state
  if (user === undefined || vehicles === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show not found state
  if (user === null) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
            <Users className="size-10 text-muted-foreground" />
          </div>
          <h1 className="mb-2 font-bold text-2xl">User Not Found</h1>
          <p className="mb-6 text-center text-muted-foreground">
            The user you're looking for doesn't exist or may have been removed.
          </p>
          <Button onClick={() => router.push("/vehicles")} variant="default">
            Browse Vehicles
          </Button>
        </div>
      </div>
    )
  }

  const firstName = user.name?.split(" ")[0] || "User"

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <ProfileHero
        isAllStarHost={isAllStarHost}
        isSuperHost={isSuperHost}
        isVerified={isVerified}
        memberSinceDate={memberSinceDate}
        totalRentals={totalRentals}
        totalReviews={totalReviews}
        user={user}
        userRating={userRating}
        vehicleCount={mappedVehicles.length}
      />

      {/* Main Content */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <ProfileSidebar
            firstName={firstName}
            isAllStarHost={isAllStarHost}
            isSuperHost={isSuperHost}
            reviewStats={reviewStats}
            totalRentals={totalRentals}
            totalReviews={totalReviews}
            user={user}
            userRating={userRating}
          />

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="vehicles" onValueChange={setActiveTab} value={activeTab}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger className="gap-2" value="vehicles">
                  <Car className="size-4" />
                  Vehicles ({mappedVehicles.length})
                </TabsTrigger>
                <TabsTrigger className="gap-2" value="reviews">
                  <Star className="size-4" />
                  Reviews ({totalReviews})
                </TabsTrigger>
              </TabsList>

              {/* Vehicles Tab */}
              <TabsContent className="mt-0" value="vehicles">
                {mappedVehicles.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {mappedVehicles.map((vehicle) => (
                      <VehicleCard key={vehicle.id} {...vehicle} />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                        <Car className="size-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 font-semibold text-lg">No Vehicles Listed</h3>
                      <p className="text-muted-foreground">
                        {firstName} hasn't listed any vehicles yet.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent className="mt-0" value="reviews">
                {reviews && reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <ReviewCard
                        key={review._id}
                        firstName={firstName}
                        review={review as ReviewData}
                      />
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                        <Star className="size-8 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 font-semibold text-lg">No Reviews Yet</h3>
                      <p className="text-muted-foreground">
                        {firstName} hasn't received any reviews yet. Be the first to rent and leave
                        a review!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
