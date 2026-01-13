"use client"

import { useQuery, useMutation } from "convex/react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { api } from "@/lib/convex"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  ArrowLeft,
  Ban,
  UserCheck,
  Loader2,
  User,
  Calendar,
  Star,
  Car,
  DollarSign,
  Shield,
  Mail,
  Phone,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@/lib/convex"

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as Id<"users">
  const allUsers = useQuery(api.admin.getAllUsers, { limit: 1000 })
  const user = allUsers?.find((u) => u._id === userId)
  const userDetail = useQuery(api.admin.getUserDetail, { userId })
  const renterReservations = useQuery(
    api.reservations.getByUser,
    user?.externalId ? { userId: user.externalId, role: "renter" } : "skip"
  )
  const ownerReservations = useQuery(
    api.reservations.getByUser,
    user?.externalId ? { userId: user.externalId, role: "owner" } : "skip"
  )
  const vehicles = useQuery(
    api.vehicles.getByOwner,
    user?.externalId ? { ownerId: user.externalId } : "skip"
  )
  const reviewsGiven = useQuery(
    api.reviews.getByUser,
    user?.externalId ? { userId: user.externalId } : "skip"
  )
  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleBan = async () => {
    if (!confirm("Are you sure you want to ban this user?")) {
      return
    }

    setIsProcessing(true)
    try {
      await banUser({ userId })
      toast.success("User banned successfully")
    } catch (error) {
      console.error("Failed to ban user:", error)
      toast.error("An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnban = async () => {
    setIsProcessing(true)
    try {
      await unbanUser({ userId })
      toast.success("User unbanned successfully")
    } catch (error) {
      console.error("Failed to unban user:", error)
      toast.error("An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`size-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating}</span>
      </div>
    )
  }

  if (allUsers === undefined || userDetail === undefined) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-muted-foreground">Loading user...</div>
      </div>
    )
  }

  if (!user || userDetail === null) {
    return (
      <div className="space-y-6">
        <Link href="/users">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 size-4" />
            Back to Users
          </Button>
        </Link>
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            User not found
          </CardContent>
        </Card>
      </div>
    )
  }

  const isBanned = user.isBanned === true

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/users">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 size-4" />
              Back to Users
            </Button>
          </Link>
          <h1 className="font-bold text-3xl">{user.name}</h1>
          <p className="text-muted-foreground mt-2">User ID: {user._id}</p>
        </div>
        <div className="flex items-center gap-4">
          {isBanned && <Badge variant="destructive">Banned</Badge>}
          {user.role && <Badge variant="outline">{user.role}</Badge>}
          {isBanned ? (
            <Button onClick={handleUnban} disabled={isProcessing} variant="default">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 size-4" />
                  Unban User
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleBan} disabled={isProcessing} variant="destructive">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Ban className="mr-2 size-4" />
                  Ban User
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Profile Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Reservations</CardTitle>
            <Calendar className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{userDetail.totalReservations}</div>
            <p className="text-muted-foreground text-xs mt-1">
              {userDetail.renterReservations} as renter, {userDetail.ownerReservations} as owner
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Vehicles</CardTitle>
            <Car className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{userDetail.vehicles}</div>
            <p className="text-muted-foreground text-xs mt-1">Owned vehicles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Reviews</CardTitle>
            <Star className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {userDetail.reviewsGiven + userDetail.reviewsReceived}
            </div>
            <p className="text-muted-foreground text-xs mt-1">
              {userDetail.reviewsGiven} given, {userDetail.reviewsReceived} received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Disputes</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{userDetail.disputes}</div>
            <p className="text-muted-foreground text-xs mt-1">Involved in</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="reservations">
            Reservations ({userDetail.totalReservations})
          </TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles ({userDetail.vehicles})</TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews ({userDetail.reviewsGiven + userDetail.reviewsReceived})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="size-5" />
                  <CardTitle>Basic Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-sm">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-sm">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-sm">Phone</p>
                      <p className="font-medium">{user.phone}</p>
                    </div>
                  </div>
                )}
                {user.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-sm">Location</p>
                      <p className="font-medium">{user.location}</p>
                    </div>
                  </div>
                )}
                {user.bio && (
                  <div>
                    <p className="text-muted-foreground text-sm">Bio</p>
                    <p className="mt-1">{user.bio}</p>
                  </div>
                )}
                {user.externalId && (
                  <div>
                    <p className="text-muted-foreground text-sm">External ID (Clerk)</p>
                    <p className="font-mono text-sm">{user.externalId}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.rating && (
                  <div>
                    <p className="text-muted-foreground text-sm">Rating</p>
                    <div className="mt-1">{renderStars(user.rating)}</div>
                  </div>
                )}
                {user.totalRentals !== undefined && (
                  <div>
                    <p className="text-muted-foreground text-sm">Total Rentals</p>
                    <p className="font-medium">{user.totalRentals}</p>
                  </div>
                )}
                {user.isHost && (
                  <div>
                    <p className="text-muted-foreground text-sm">Host Status</p>
                    <Badge variant="default">Host</Badge>
                  </div>
                )}
                {user.stripeAccountStatus && (
                  <div>
                    <p className="text-muted-foreground text-sm">Stripe Account Status</p>
                    <Badge variant="outline">{user.stripeAccountStatus}</Badge>
                  </div>
                )}
                {user.memberSince && (
                  <div>
                    <p className="text-muted-foreground text-sm">Member Since</p>
                    <p className="font-medium">{user.memberSince}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-sm">Account Created</p>
                  <p className="font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4">
          {renterReservations && renterReservations.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold">As Renter</h3>
              {renterReservations.map((reservation) => (
                <Card key={reservation._id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{reservation.status}</Badge>
                          <Link href={`/reservations/${reservation._id}`}>
                            <Button variant="link" className="h-auto p-0">
                              View Reservation
                            </Button>
                          </Link>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Vehicle:</strong> {reservation.vehicle?.year}{" "}
                              {reservation.vehicle?.make} {reservation.vehicle?.model}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Dates:</strong> {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Total:</strong> {formatCurrency(reservation.totalAmount)}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Owner:</strong> {reservation.owner?.name || "Unknown"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {ownerReservations && ownerReservations.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold mt-6">As Owner</h3>
              {ownerReservations.map((reservation) => (
                <Card key={reservation._id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{reservation.status}</Badge>
                          <Link href={`/reservations/${reservation._id}`}>
                            <Button variant="link" className="h-auto p-0">
                              View Reservation
                            </Button>
                          </Link>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Vehicle:</strong> {reservation.vehicle?.year}{" "}
                              {reservation.vehicle?.make} {reservation.vehicle?.model}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Dates:</strong> {formatDate(reservation.startDate)} -{" "}
                              {formatDate(reservation.endDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">
                              <strong>Total:</strong> {formatCurrency(reservation.totalAmount)}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Renter:</strong> {reservation.renter?.name || "Unknown"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(!renterReservations || renterReservations.length === 0) &&
            (!ownerReservations || ownerReservations.length === 0) && (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Calendar className="mx-auto mb-4 size-12 opacity-50" />
                  <p>No reservations found</p>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          {vehicles && vehicles.length > 0 ? (
            <div className="space-y-4">
              {vehicles.map((vehicle) => {
                const primaryImage =
                  vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
                return (
                  <Card key={vehicle._id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {primaryImage && (
                          <div className="flex-shrink-0">
                            <img
                              src={primaryImage.cardUrl || primaryImage.imageUrl}
                              alt={`${vehicle.make} ${vehicle.model}`}
                              className="h-24 w-32 rounded-lg object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{vehicle.status}</Badge>
                            <Link href={`/vehicles/${vehicle._id}`}>
                              <Button variant="link" className="h-auto p-0">
                                View Vehicle
                              </Button>
                            </Link>
                          </div>
                          <h4 className="font-semibold">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h4>
                          <p className="text-muted-foreground text-sm">
                            Daily Rate: {formatCurrency(vehicle.dailyRate)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Car className="mx-auto mb-4 size-12 opacity-50" />
                <p>No vehicles found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {reviewsGiven && reviewsGiven.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold">Reviews Given</h3>
              {reviewsGiven.map((review) => (
                <Card key={review._id}>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{review.title}</h4>
                          <div className="mt-1">{renderStars(review.rating)}</div>
                        </div>
                        <Badge variant="outline">
                          {review.reviewType === "renter_to_owner"
                            ? "Renter → Owner"
                            : "Owner → Renter"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">{review.review}</p>
                      <div className="flex items-center gap-4 text-muted-foreground text-xs">
                        <span>
                          <strong>Reviewed:</strong> {review.reviewed?.name || "Unknown"}
                        </span>
                        <span>
                          <strong>Date:</strong>{" "}
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Star className="mx-auto mb-4 size-12 opacity-50" />
                <p>No reviews found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
