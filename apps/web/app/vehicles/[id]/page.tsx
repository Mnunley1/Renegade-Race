"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Dialog, DialogContent } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  Car,
  Check,
  Edit,
  Gauge,
  Heart,
  LogIn,
  MapPin,
  MessageSquare,
  Route,
  Share2,
  Shield,
  Star,
  UserPlus,
  Zap,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState, useMemo, useEffect, useRef } from "react"
import Link from "next/link"
import { VehicleGallery } from "@/components/vehicle-gallery"
import { api } from "@/lib/convex"

export default function VehicleDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn, user } = useUser()
  const id = params.id as string
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const hasTrackedView = useRef(false)

  const vehicle = useQuery(api.vehicles.getById, { id: id as any })
  const reviews = useQuery(api.reviews.getByVehicle, id ? { vehicleId: id as any } : "skip")
  const reviewStats = useQuery(api.reviews.getVehicleStats, id ? { vehicleId: id as any } : "skip")
  
  // Check if user has a completed reservation for this vehicle (to show "Write Review" button)
  const completedReservation = useQuery(
    api.reservations.getCompletedReservationForVehicle,
    isSignedIn && user?.id && id
      ? { userId: user.id, vehicleId: id as any }
      : "skip"
  )

  // Check if user has already written a review for this vehicle
  const hasUserReviewed = useMemo(() => {
    if (!isSignedIn || !user?.id || !reviews) return false
    return reviews.some((review) => review.reviewerId === user.id)
  }, [isSignedIn, user?.id, reviews])

  // Check if vehicle is favorited
  const isFavorite = useQuery(
    api.favorites.isVehicleFavorited,
    isSignedIn && id ? { vehicleId: id as any } : "skip"
  )

  // Toggle favorite mutation
  const toggleFavorite = useMutation(api.favorites.toggleFavorite)

  // Create conversation mutation
  const createConversation = useMutation(api.conversations.create)

  // Track view and share mutations
  const trackView = useMutation(api.vehicleAnalytics.trackView)
  const trackShare = useMutation(api.vehicleAnalytics.trackShare)

  const handleFavoriteClick = async () => {
    // If not signed in, show login dialog
    if (!isSignedIn) {
      setShowLoginDialog(true)
      return
    }

    // If vehicle is not loaded yet, wait
    if (isFavorite === undefined || !id) {
      return
    }

    // Don't proceed if we're not sure about auth state
    if (!user?.id) {
      setShowLoginDialog(true)
      return
    }

    try {
      await toggleFavorite({ vehicleId: id as any })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to toggle favorite"
      console.error("Error toggling favorite:", error)

      // If authentication error, show login dialog
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      }
    }
  }

  const handleLogin = () => {
    setShowLoginDialog(false)
    router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`)
  }

  const handleMessageHost = async () => {
    // If not signed in, show login dialog
    if (!(isSignedIn && user?.id)) {
      setShowLoginDialog(true)
      return
    }

    // If vehicle or owner not loaded, wait
    if (!(vehicle && vehicle.ownerId)) {
      return
    }

    // Don't allow messaging yourself
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

      // Navigate to the messages page
      router.push(`/messages/${conversationId as string}`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to start conversation"

      // If authentication error, show login dialog
      if (errorMessage.includes("Not authenticated") || errorMessage.includes("authentication")) {
        setShowLoginDialog(true)
      }
    } finally {
      setIsCreatingConversation(false)
    }
  }

  // Track view when page loads (only once per page load)
  useEffect(() => {
    // Only track if we haven't tracked yet, vehicle is loaded and active, and we have an ID
    if (!hasTrackedView.current && vehicle && vehicle.isActive && id) {
      hasTrackedView.current = true
      trackView({ vehicleId: id as any }).catch(console.error)
    }
  }, [vehicle, id, trackView])

  // Reset tracking ref when vehicle ID changes (user navigates to different vehicle)
  useEffect(() => {
    hasTrackedView.current = false
  }, [id])

  // Handle share functionality
  const handleShare = async (platform: string) => {
    if (!vehicle || !id) return

    const url = typeof window !== "undefined" ? window.location.href : ""
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    const text = `Check out this ${title} on Renegade Rentals!`

    try {
      if (platform === "copy_link") {
        await navigator.clipboard.writeText(url)
        // You could add a toast notification here
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
      } else if (platform === "linkedin") {
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
          "_blank"
        )
      }

      // Track the share
      await trackShare({
        vehicleId: id as any,
        platform,
      })
    } catch (error) {
      console.error("Error sharing:", error)
    }
  }

  // Show loading state
  if (!vehicle) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
            <p className="font-medium text-lg text-muted-foreground">Loading vehicle details...</p>
            <p className="mt-2 text-muted-foreground text-sm">Please wait</p>
          </div>
        </div>
      </div>
    )
  }

  // Extract image URLs
  const images = vehicle.images?.map((img) => img.cardUrl || img.imageUrl || "") || []

  // Host information from owner
  const host = {
    name: vehicle.owner?.name || "Unknown",
    avatar: vehicle.owner?.profileImage || "",
    verified: false, // Would need to check owner verification status
    memberSince: vehicle.owner?.memberSince || "",
    tripsCompleted: vehicle.owner?.totalRentals || 0,
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button className="mb-6" onClick={() => router.back()} variant="ghost">
          ← Back
        </Button>

        {/* Header Section */}
        <div className="mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-3">
                <h1 className="font-bold text-4xl">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h1>
                <Button
                  className="h-10 w-10 shrink-0"
                  onClick={handleFavoriteClick}
                  size="icon"
                  variant="outline"
                >
                  <Heart
                    className={cn(
                      "size-5 transition-colors",
                      isFavorite === true ? "fill-red-500 text-red-500" : "text-muted-foreground"
                    )}
                  />
                </Button>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" />
                  <span>{vehicle.track?.location || vehicle.track?.name || "Location TBD"}</span>
                </div>
                {reviewStats && reviewStats.averageRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="size-4 fill-primary text-primary" />
                    <span className="font-semibold">{reviewStats.averageRating.toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">
                      ({reviewStats.totalReviews || 0})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Section */}
            <div className="rounded-lg border-2 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center md:min-w-[200px]">
              <p className="mb-1 text-muted-foreground text-sm">Starting at</p>
              <div className="mb-2 flex items-baseline justify-center gap-1">
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold text-4xl text-transparent">
                  ${vehicle.dailyRate.toLocaleString()}
                </span>
                <span className="text-muted-foreground text-sm">/day</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VehicleGallery
        images={images}
        vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="size-5 text-primary" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-muted-foreground">{vehicle.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5 text-primary" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vehicle.horsepower ||
              vehicle.transmission ||
              vehicle.drivetrain ||
              vehicle.engineType ||
              vehicle.mileage ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {vehicle.horsepower && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Zap className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Horsepower
                        </p>
                        <p className="font-bold text-2xl">
                          {vehicle.horsepower.toLocaleString()} hp
                        </p>
                      </div>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Car className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Transmission
                        </p>
                        <p className="font-bold text-xl">{vehicle.transmission}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.drivetrain && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Route className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Drivetrain
                        </p>
                        <p className="font-bold text-xl">{vehicle.drivetrain}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.engineType && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Gauge className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Engine Type
                        </p>
                        <p className="font-bold text-xl">{vehicle.engineType}</p>
                      </div>
                    </div>
                  )}
                  {vehicle.mileage && (
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Route className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Mileage
                        </p>
                        <p className="font-bold text-xl">
                          {vehicle.mileage.toLocaleString()} miles
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  No specifications available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Amenities Card */}
          {vehicle.amenities && vehicle.amenities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="size-5 text-primary" />
                  Amenities & Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vehicle.amenities.map((amenity) => (
                    <div className="flex items-center gap-2" key={amenity}>
                      <Check className="size-4 shrink-0 text-primary" />
                      <span className="text-sm">{amenity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Track Information Card */}
          {vehicle.track && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="size-5 text-primary" />
                  Track Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 font-semibold text-lg">{vehicle.track.name}</h3>
                    {vehicle.track.description && (
                      <p className="text-muted-foreground leading-relaxed">
                        {vehicle.track.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" />
                    <span>{vehicle.track.location}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Star className="size-5 text-primary" />
                  Reviews
                  {reviewStats && reviewStats.totalReviews > 0 && (
                    <span className="ml-2 font-normal text-base text-muted-foreground">
                      ({reviewStats.totalReviews})
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  {reviewStats && reviewStats.averageRating > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
                      <Star className="size-5 fill-primary text-primary" />
                      <span className="font-bold text-lg">
                        {reviewStats.averageRating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {completedReservation && (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                    >
                      <Link href={`/trips/review/${completedReservation._id}`}>
                        <Star className="mr-2 size-4" />
                        {hasUserReviewed ? "Edit Review" : "Write Review"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => {
                    const isUserReview = review.reviewerId === user?.id
                    return (
                      <div
                        className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                        key={review._id}
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              {review.reviewerId ? (
                                <Link
                                  href={`/r/${review.reviewerId}`}
                                  className="font-semibold transition-colors hover:text-primary"
                                >
                                  {review.reviewer?.name || "Anonymous"}
                                </Link>
                              ) : (
                                <p className="font-semibold">{review.reviewer?.name || "Anonymous"}</p>
                              )}
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    className={cn(
                                      "size-4",
                                      i < review.rating
                                        ? "fill-primary text-primary"
                                        : "text-muted-foreground"
                                    )}
                                    key={i}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {new Date(review.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                              {review.updatedAt && review.updatedAt !== review.createdAt && (
                                <span className="ml-2 text-xs">(edited)</span>
                              )}
                            </p>
                          </div>
                          {isUserReview && review.reservation && (
                            <Link href={`/trips/review/${review.reservation._id}`}>
                              <Button size="sm" variant="ghost" className="gap-2">
                                <Edit className="size-4" />
                                Edit
                              </Button>
                            </Link>
                          )}
                        </div>
                        {review.title && <p className="mb-2 font-semibold text-lg">{review.title}</p>}
                        {review.review && (
                          <p className="text-muted-foreground leading-relaxed">{review.review}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Star className="mx-auto mb-4 size-12 text-muted-foreground/30" />
                  <p className="mb-2 font-semibold text-lg">No reviews yet</p>
                  <p className="mb-4 text-muted-foreground">
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
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6">
            <Card className="border-2">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>Book this vehicle</CardTitle>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-bold text-2xl text-transparent">
                        ${vehicle.dailyRate.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-sm">/day</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Select your dates and add-ons on the checkout page
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/checkout?vehicleId=${vehicle._id}`)}
                    size="lg"
                  >
                    Reserve Now
                  </Button>
                  <p className="text-center text-muted-foreground text-xs">
                    You won't be charged until checkout
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-primary" />
                  Host Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Link href={`/r/${vehicle.ownerId}`} className="block">
                    <div className="flex items-center gap-4 transition-opacity hover:opacity-80">
                      <Avatar className="size-16">
                        <AvatarImage src={host.avatar} />
                        <AvatarFallback>{host.name[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold transition-colors hover:text-primary">
                            {host.name}
                          </h3>
                          {host.verified && (
                            <Badge className="bg-green-500" variant="default">
                              <Shield className="mr-1 size-3" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {host.memberSince && `Member since ${host.memberSince}`}
                          {host.memberSince && host.tripsCompleted > 0 && " • "}
                          {host.tripsCompleted > 0 && `${host.tripsCompleted} trips`}
                          {!host.memberSince && host.tripsCompleted === 0 && "New member"}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {vehicle.ownerId !== user?.id && (
                    <Button
                      className="w-full"
                      disabled={isCreatingConversation}
                      onClick={handleMessageHost}
                      variant="outline"
                    >
                      <MessageSquare className="mr-2 size-4" />
                      {isCreatingConversation ? "Loading..." : "Message Host"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="size-5 text-primary" />
                  Share Listing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="w-full"
                    onClick={() => handleShare("copy_link")}
                    size="sm"
                    variant="outline"
                  >
                    <Share2 className="mr-2 size-4" />
                    Copy Link
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => handleShare("facebook")}
                    size="sm"
                    variant="outline"
                  >
                    Facebook
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => handleShare("twitter")}
                    size="sm"
                    variant="outline"
                  >
                    Twitter
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => handleShare("linkedin")}
                    size="sm"
                    variant="outline"
                  >
                    LinkedIn
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Login Dialog */}
      <Dialog onOpenChange={setShowLoginDialog} open={showLoginDialog}>
        <DialogContent className="border-0 bg-white/95 p-0 shadow-2xl backdrop-blur sm:max-w-md dark:bg-gray-900/95">
          <Card className="border-0 shadow-none">
            <CardContent className="p-8">
              {/* Header */}
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

              {/* Action buttons */}
              <div className="space-y-3">
                <Button
                  className="w-full bg-[#EF1C25] text-white hover:bg-[#EF1C25]/90"
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

              {/* Additional info */}
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
  )
}
