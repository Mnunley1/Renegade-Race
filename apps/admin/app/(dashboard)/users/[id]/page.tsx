"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useMutation, useQuery } from "convex/react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Ban,
  Calendar,
  Car,
  CreditCard,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Settings,
  Shield,
  Star,
  User,
  UserCheck,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DetailPageLayout } from "@/components/detail-page-layout"
import { LoadingState } from "@/components/loading-state"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import type { Id } from "@/lib/convex"
import { api } from "@/lib/convex"
import { handleErrorWithContext } from "@/lib/error-handler"

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)

type UserDetail = NonNullable<ReturnType<typeof useQuery<typeof api.admin.getUserDetail>>>

function getUserTypeLabel(userType: string | undefined): string {
  if (userType === "team") return "Team"
  if (userType === "both") return "Driver & Team"
  return "Driver"
}

type ReservationItem = {
  _id: string
  status: string
  totalAmount: number
  totalDays: number
  startDate: string
  endDate: string
  dailyRate: number
  vehicle?: { year?: number; make?: string; model?: string; _id?: string } | null
  renter?: { name?: string } | null
  owner?: { name?: string } | null
}

type VehicleItem = {
  _id: string
  year: number
  make: string
  model: string
  dailyRate: number
  status?: string
  isActive?: boolean
  isApproved?: boolean | null
  isSuspended?: boolean
  images?: Array<{ isPrimary: boolean; cardUrl?: string; imageUrl?: string }>
}

type ReviewItem = {
  _id: string
  rating: number
  title?: string
  review?: string
  reviewType?: string
  createdAt: number
  reviewed?: { name?: string } | null
}

function SummaryCards({ detail }: { detail: UserDetail }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Reservations</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{detail.totalReservations}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {detail.renterReservations} as renter, {detail.ownerReservations} as owner
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Vehicles</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
              <Car className="h-4 w-4 text-purple-700 dark:text-purple-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{detail.vehicles}</p>
          <p className="mt-1 text-muted-foreground text-xs">Owned vehicles</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Reviews</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
              <Star className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">
            {detail.reviewsGiven + detail.reviewsReceived}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            {detail.reviewsGiven} given, {detail.reviewsReceived} received
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <p className="font-medium text-muted-foreground text-sm">Disputes</p>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/50">
              <Shield className="h-4 w-4 text-red-700 dark:text-red-400" />
            </div>
          </div>
          <p className="mt-3 font-bold text-2xl tracking-tight">{detail.disputes}</p>
          <p className="mt-1 text-muted-foreground text-xs">Involved in</p>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileCard({ user }: { user: UserDetail["user"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar email={user.email} name={user.name} showInfo={false} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-lg">{user.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {user.isHost && (
                <Badge
                  className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400"
                  variant="secondary"
                >
                  Host
                </Badge>
              )}
              <Badge variant="outline">{getUserTypeLabel(user.userType)}</Badge>
            </div>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          {user.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{user.email}</span>
            </div>
          )}
          {user.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{user.phone}</span>
            </div>
          )}
          {user.location && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{user.location}</span>
            </div>
          )}
        </div>
        {user.bio && (
          <>
            <Separator />
            <div>
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Bio
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{user.bio}</p>
            </div>
          </>
        )}
        {user.experience && (
          <>
            <Separator />
            <div>
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Experience
              </p>
              <p className="text-sm">{user.experience}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AccountStatusCard({ user }: { user: UserDetail["user"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Account Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Account</span>
          <StatusBadge status={user.isBanned ? "banned" : "active"} />
        </div>
        {user.rating != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rating</span>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">{user.rating}</span>
            </div>
          </div>
        )}
        {user.totalRentals != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Rentals</span>
            <span className="font-medium">{user.totalRentals}</span>
          </div>
        )}
        {user.isHost && user.stripeAccountStatus && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stripe Connect</span>
            <StatusBadge status={user.stripeAccountStatus} />
          </div>
        )}
        {user.isHost && user.hostOnboardingStatus && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Host Onboarding</span>
            <StatusBadge status={user.hostOnboardingStatus} />
          </div>
        )}
        <Separator />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member Since</span>
            <span className="font-medium">
              {user.memberSince || format(user._creationTime, "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Joined</span>
            <span className="font-medium">
              {formatDistanceToNow(user._creationTime, { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function IdentifiersCard({ user }: { user: UserDetail["user"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identifiers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">User ID</span>
            <span className="break-all text-right font-mono text-xs">{user._id}</span>
          </div>
          {user.externalId && (
            <div className="flex items-start justify-between gap-4">
              <span className="shrink-0 text-muted-foreground">Clerk ID</span>
              <span className="break-all text-right font-mono text-xs">{user.externalId}</span>
            </div>
          )}
          {user.stripeCustomerId && (
            <div className="flex items-start justify-between gap-4">
              <span className="shrink-0 text-muted-foreground">Stripe Customer</span>
              <span className="break-all text-right font-mono text-xs">
                {user.stripeCustomerId}
              </span>
            </div>
          )}
          {user.stripeAccountId && (
            <div className="flex items-start justify-between gap-4">
              <span className="shrink-0 text-muted-foreground">Stripe Connect</span>
              <span className="break-all text-right font-mono text-xs">{user.stripeAccountId}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityCard({ detail }: { detail: UserDetail }) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Activity Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Reservations (as renter)</span>
          <span className="font-medium">{detail.renterReservations}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Reservations (as owner)</span>
          <span className="font-medium">{detail.ownerReservations}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Reviews given</span>
          <span className="font-medium">{detail.reviewsGiven}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Reviews received</span>
          <span className="font-medium">{detail.reviewsReceived}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payments</span>
          <span className="font-medium">{detail.payments}</span>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <Button
            className="w-full justify-start"
            onClick={() => router.push("/reservations")}
            size="sm"
            variant="outline"
          >
            <Calendar className="mr-2 h-3.5 w-3.5" />
            View Reservations
          </Button>
          <Button
            className="w-full justify-start"
            onClick={() => router.push("/payments")}
            size="sm"
            variant="outline"
          >
            <CreditCard className="mr-2 h-3.5 w-3.5" />
            View Payments
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ReservationsSection({
  reservations,
  label,
  roleLabel,
}: {
  reservations: ReservationItem[] | undefined
  label: string
  roleLabel: string
}) {
  const router = useRouter()

  if (!reservations || reservations.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-muted-foreground text-sm">{label}</h3>
      {reservations.slice(0, 5).map((reservation) => (
        <div
          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
          key={reservation._id}
        >
          <div className="flex items-center gap-3">
            <StatusBadge status={reservation.status} />
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">
                {reservation.vehicle
                  ? `${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`
                  : "Unknown vehicle"}
              </p>
              <p className="text-muted-foreground text-xs">
                {format(new Date(reservation.startDate), "MMM d")} -{" "}
                {format(new Date(reservation.endDate), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-semibold text-sm">{formatCurrency(reservation.totalAmount)}</p>
              <p className="text-muted-foreground text-xs">
                {reservation.totalDays} {reservation.totalDays === 1 ? "day" : "days"}
              </p>
            </div>
            <Button
              onClick={() => router.push(`/reservations/${reservation._id}`)}
              size="sm"
              variant="ghost"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {reservations.length > 5 && (
        <p className="pt-1 text-center text-muted-foreground text-xs">
          Showing 5 of {reservations.length} {roleLabel} reservations
        </p>
      )}
    </div>
  )
}

function ReservationsCard({
  renterReservations,
  ownerReservations,
}: {
  renterReservations: ReservationItem[] | undefined
  ownerReservations: ReservationItem[] | undefined
}) {
  const hasRenter = renterReservations && renterReservations.length > 0
  const hasOwner = ownerReservations && ownerReservations.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Reservations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasRenter || hasOwner ? (
          <div className="space-y-6">
            <ReservationsSection
              label="As Renter"
              reservations={renterReservations}
              roleLabel="renter"
            />
            {hasRenter && hasOwner && <Separator />}
            <ReservationsSection
              label="As Owner"
              reservations={ownerReservations}
              roleLabel="owner"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-center">
            <Calendar className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">No reservations yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VehiclesCard({ vehicles }: { vehicles: VehicleItem[] | undefined }) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4" />
          Vehicles ({vehicles?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!vehicles || vehicles.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Car className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground text-sm">No vehicles listed</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.slice(0, 5).map((vehicle) => {
              const primaryImage =
                vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
              return (
                <div
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  key={vehicle._id}
                >
                  {primaryImage && (
                    <img
                      alt={`${vehicle.make} ${vehicle.model}`}
                      className="h-12 w-16 shrink-0 rounded-md object-cover"
                      src={primaryImage.cardUrl || primaryImage.imageUrl}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatCurrency(vehicle.dailyRate)}/day
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push(`/vehicles/${vehicle._id}`)}
                    size="sm"
                    variant="ghost"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
            {vehicles.length > 5 && (
              <p className="pt-1 text-center text-muted-foreground text-xs">
                Showing 5 of {vehicles.length} vehicles
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReviewsCard({ reviews }: { reviews: ReviewItem[] | undefined }) {
  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4" />
            Reviews Given
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8 text-center">
          <Star className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground text-sm">No reviews given yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" />
          Reviews Given ({reviews.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviews.slice(0, 5).map((review) => (
            <div className="rounded-lg border p-4" key={review._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          className={`h-3.5 w-3.5 ${
                            star <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }`}
                          key={star}
                        />
                      ))}
                    </div>
                    <span className="font-medium text-sm">{review.rating}</span>
                  </div>
                  {review.title && <p className="mt-1 font-medium text-sm">{review.title}</p>}
                </div>
                <Badge variant="outline">
                  {review.reviewType === "renter_to_owner" ? "Renter" : "Owner"}
                </Badge>
              </div>
              {review.review && (
                <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">{review.review}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-muted-foreground text-xs">
                <span>{review.reviewed?.name || "Unknown"}</span>
                <span>{format(review.createdAt, "MMM d, yyyy")}</span>
              </div>
            </div>
          ))}
          {reviews.length > 5 && (
            <p className="pt-1 text-center text-muted-foreground text-xs">
              Showing 5 of {reviews.length} reviews
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function OnboardingStepsCard({ user }: { user: UserDetail["user"] }) {
  if (!(user.isHost && user.hostOnboardingSteps)) return null

  const steps = user.hostOnboardingSteps
  const stepList = [
    { label: "Personal Info", done: steps.personalInfo },
    { label: "Vehicle Added", done: steps.vehicleAdded },
    { label: "Payout Setup", done: steps.payoutSetup },
    { label: "Safety Standards", done: steps.safetyStandards },
  ]

  const completedCount = stepList.filter((s) => s.done).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Host Onboarding ({completedCount}/{stepList.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {stepList.map((step) => (
            <div className="flex items-center gap-3 text-sm" key={step.label}>
              <div
                className={`h-2 w-2 rounded-full ${step.done ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
              />
              <span className={step.done ? "" : "text-muted-foreground"}>{step.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as Id<"users">
  const userDetail = useQuery(api.admin.getUserDetail, { userId })
  const renterReservations = useQuery(
    api.reservations.getByUser,
    userDetail?.user.externalId ? { userId: userDetail.user.externalId, role: "renter" } : "skip"
  )
  const ownerReservations = useQuery(
    api.reservations.getByUser,
    userDetail?.user.externalId ? { userId: userDetail.user.externalId, role: "owner" } : "skip"
  )
  const vehicles = useQuery(
    api.vehicles.getByOwner,
    userDetail?.user.externalId ? { ownerId: userDetail.user.externalId } : "skip"
  )
  const reviewsGiven = useQuery(
    api.reviews.getByUser,
    userDetail?.user.externalId
      ? { userId: userDetail.user.externalId, role: "reviewer" as const }
      : "skip"
  )
  const banUser = useMutation(api.admin.banUser)
  const unbanUser = useMutation(api.admin.unbanUser)

  const [isProcessing, setIsProcessing] = useState(false)
  const [banConfirm, setBanConfirm] = useState(false)
  const [unbanConfirm, setUnbanConfirm] = useState(false)

  const handleBan = async () => {
    setIsProcessing(true)
    try {
      await banUser({ userId })
      toast.success("User banned successfully")
      setBanConfirm(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "ban user", entity: "user" })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUnban = async () => {
    setIsProcessing(true)
    try {
      await unbanUser({ userId })
      toast.success("User unbanned successfully")
      setUnbanConfirm(false)
    } catch (error) {
      handleErrorWithContext(error, { action: "unban user", entity: "user" })
    } finally {
      setIsProcessing(false)
    }
  }

  if (userDetail === undefined) {
    return <LoadingState message="Loading user details..." />
  }

  if (userDetail === null) {
    return (
      <DetailPageLayout title="User Not Found">
        <p className="text-muted-foreground">This user could not be found.</p>
      </DetailPageLayout>
    )
  }

  const user = userDetail.user
  const isBanned = user.isBanned === true

  return (
    <DetailPageLayout
      actions={
        isBanned ? (
          <Button onClick={() => setUnbanConfirm(true)} size="sm">
            <UserCheck className="mr-2 h-4 w-4" />
            Unban User
          </Button>
        ) : (
          <Button onClick={() => setBanConfirm(true)} size="sm" variant="destructive">
            <Ban className="mr-2 h-4 w-4" />
            Ban User
          </Button>
        )
      }
      badges={
        <div className="flex items-center gap-2">
          {isBanned && <StatusBadge status="banned" />}
          {user.isHost && (
            <Badge
              className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400"
              variant="secondary"
            >
              Host
            </Badge>
          )}
          <Badge variant="outline">{getUserTypeLabel(user.userType)}</Badge>
        </div>
      }
      title={user.name}
    >
      <SummaryCards detail={userDetail} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfileCard user={user} />
          <ReservationsCard
            ownerReservations={ownerReservations as ReservationItem[] | undefined}
            renterReservations={renterReservations as ReservationItem[] | undefined}
          />
          <VehiclesCard vehicles={vehicles as VehicleItem[] | undefined} />
          <ReviewsCard reviews={reviewsGiven as ReviewItem[] | undefined} />
        </div>

        <div className="space-y-6">
          <AccountStatusCard user={user} />
          <ActivityCard detail={userDetail} />
          <OnboardingStepsCard user={user} />
          <IdentifiersCard user={user} />
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="Ban User"
        description="Are you sure you want to ban this user? They will be unable to access the platform, and their active listings will be hidden."
        isLoading={isProcessing}
        onConfirm={handleBan}
        onOpenChange={setBanConfirm}
        open={banConfirm}
        title="Ban User"
        variant="destructive"
      />
      <ConfirmDialog
        confirmLabel="Unban User"
        description="This will restore the user's access to the platform. Their listings and account will become active again."
        isLoading={isProcessing}
        onConfirm={handleUnban}
        onOpenChange={setUnbanConfirm}
        open={unbanConfirm}
        title="Unban User"
      />
    </DetailPageLayout>
  )
}
