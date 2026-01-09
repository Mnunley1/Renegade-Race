"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { Car, Check, HelpCircle, Loader2, MapPin, Star } from "lucide-react"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"

export default function UserProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const [showFullBio, setShowFullBio] = useState(false)

  // Fetch user, their vehicles, and review stats
  const user = useQuery(api.users.getByExternalId, userId ? { externalId: userId } : "skip")
  const vehicles = useQuery(api.vehicles.getByOwner, userId ? { ownerId: userId } : "skip")
  const reviewStats = useQuery(api.reviews.getUserStats, userId ? { userId } : "skip")

  // Fetch vehicle stats for user's vehicles
  const userVehicleIds = useMemo(() => {
    if (!vehicles) return []
    return vehicles.map((v) => v._id) as any[]
  }, [vehicles])

  const userVehicleStats = useQuery(
    api.reviews.getVehicleStatsBatch,
    userVehicleIds.length > 0 ? { vehicleIds: userVehicleIds } : "skip"
  )

  // Map vehicles to the format expected by VehicleCard
  const mappedVehicles = useMemo(() => {
    if (!vehicles) return []
    return vehicles.map((vehicle) => {
      const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
      const stats = userVehicleStats?.[vehicle._id]
      return {
        id: vehicle._id,
        image: primaryImage?.cardUrl ?? "",
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
      }
    })
  }, [vehicles, userVehicleStats])

  // Get rating from review stats or user rating
  const userRating = reviewStats?.averageRating || user?.rating || 0
  const totalTrips = user?.totalRentals || 0
  const memberSinceDate = user?.memberSince
    ? new Date(user.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null

  // Bio text - placeholder for now (could be extended to fetch from driver profile)
  const bioText = "No bio available yet."

  // Truncate bio if needed
  const MAX_BIO_LENGTH = 200
  const shouldTruncate = bioText.length > MAX_BIO_LENGTH
  const displayBio =
    showFullBio || !shouldTruncate ? bioText : `${bioText.substring(0, MAX_BIO_LENGTH)}...`

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
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 font-bold text-2xl">User Not Found</h1>
            <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    )
  }

  const userInitials = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
  const location = "" // Could be fetched from driver profile or user location if available

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Profile Information */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="space-y-4">
              <div className="relative inline-block">
                <Avatar className="size-32">
                  <AvatarImage alt={user.name || "User"} src={user.profileImage} />
                  <AvatarFallback className="text-3xl">{userInitials}</AvatarFallback>
                </Avatar>
                {/* Rating Badge Overlay */}
                {userRating > 0 && (
                  <div className="absolute bottom-0 left-0 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-white shadow-lg">
                    <Star className="size-3.5 fill-white" />
                    <span className="font-bold text-sm">{userRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              <div>
                <h1 className="mb-2 font-bold text-3xl">{user.name || "User"}</h1>
                {location && (
                  <p className="mb-2 flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="size-4" />
                    {location}
                  </p>
                )}
                {totalTrips > 0 && memberSinceDate && (
                  <p className="text-muted-foreground">
                    {totalTrips.toLocaleString()} trips • Joined {memberSinceDate}
                  </p>
                )}
                {totalTrips === 0 && memberSinceDate && (
                  <p className="text-muted-foreground">Joined {memberSinceDate}</p>
                )}
              </div>
            </div>

            {/* All-Star Host Badge */}
            {userRating >= 4.5 && totalTrips >= 10 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Star className="size-6 fill-primary text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold text-lg">All-Star Host</h3>
                      <p className="text-muted-foreground text-sm">
                        All-Star Hosts like {user.name?.split(" ")[0] || "this host"} are the
                        top-rated and most experienced hosts on Renegade Rentals.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Verified Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  Verified Info
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="size-5 text-primary" />
                    <span className="text-sm">Approved to drive</span>
                    <HelpCircle className="size-4 text-muted-foreground" />
                  </div>
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Check className="size-5 text-primary" />
                      <span className="text-sm">Email address</span>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Check className="size-5 text-primary" />
                      <span className="text-sm">Phone number</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Languages */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  Languages
                </h3>
                <p className="text-sm">English</p>
              </CardContent>
            </Card>

            {/* Works - Placeholder for now */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  Works
                </h3>
                <p className="text-sm">Not specified</p>
              </CardContent>
            </Card>

            {/* School - Placeholder for now */}
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  School
                </h3>
                <p className="text-sm">Not specified</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - About and Vehicles */}
        <div className="lg:col-span-2">
          <div className="space-y-8">
            {/* About Section */}
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  About {user.name?.split(" ")[0] || "User"}
                </h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">{displayBio}</p>
                  {shouldTruncate && (
                    <Button
                      onClick={() => setShowFullBio(!showFullBio)}
                      size="sm"
                      variant="outline"
                    >
                      {showFullBio ? "Show Less" : "More"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vehicles Section */}
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                  {user.name?.split(" ")[0] || "User"}'s Vehicles
                </h2>
                {mappedVehicles.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {mappedVehicles.map((vehicle) => (
                      <VehicleCard key={vehicle.id} {...vehicle} />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Car className="mx-auto mb-4 size-12 text-muted-foreground/30" />
                    <p className="mb-2 font-semibold text-lg">No vehicles yet</p>
                    <p className="text-muted-foreground">
                      This user hasn't listed any vehicles yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
