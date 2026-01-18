"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { useAction, useQuery } from "convex/react"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Share2,
  Star,
  TrendingUp,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { HostOnboardingChecklist } from "@/components/host-onboarding-checklist"
import { api } from "@/lib/convex"
import { handleError, handleErrorWithContext } from "@/lib/error-handler"

export default function HostDashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  const [showChecklist, setShowChecklist] = useState(false)
  const [isLoadingConnect, setIsLoadingConnect] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectStatus, setConnectStatus] = useState<{
    hasAccount: boolean
    isComplete: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    accountId?: string
  } | null>(null)

  const fetchConnectStatus = useAction(api.stripe.getConnectAccountStatus)
  const startOrContinueOnboarding = useAction(api.stripe.createConnectAccount)
  const createDashboardLink = useAction(api.stripe.createConnectLoginLink)

  // Check onboarding status
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, user?.id ? {} : "skip")

  // Redirect if onboarding not complete
  useEffect(() => {
    if (onboardingStatus && onboardingStatus.status !== "completed") {
      router.push("/host/onboarding")
    }
  }, [onboardingStatus, router])

  // Fetch data from Convex
  const vehicles = useQuery(api.vehicles.getByOwner, user?.id ? { ownerId: user.id } : "skip")
  const pendingReservations = useQuery(
    api.reservations.getPendingForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const confirmedReservations = useQuery(
    api.reservations.getConfirmedForOwner,
    user?.id ? { ownerId: user.id } : "skip"
  )
  const reviewStats = useQuery(api.reviews.getUserStats, user?.id ? { userId: user.id } : "skip")
  const vehicleAnalytics = useQuery(
    api.vehicleAnalytics.getAllVehicleAnalytics,
    user?.id ? { ownerId: user.id } : "skip"
  )

  useEffect(() => {
    const loadStatus = async () => {
      if (!user?.id) return
      setIsLoadingConnect(true)
      setConnectError(null)
      try {
        const status = await fetchConnectStatus({ ownerId: user.id })
        setConnectStatus(status)
      } catch (error) {
        handleError(error, { showToast: false })
        const errorMessage = "Failed to load payout status"
        setConnectError(errorMessage)
      } finally {
        setIsLoadingConnect(false)
      }
    }

    loadStatus()
  }, [fetchConnectStatus, user?.id])

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalVehicles = vehicles?.length || 0
    const pendingBookings = pendingReservations?.length || 0
    const upcomingBookings = confirmedReservations?.length || 0

    // Calculate total earnings from confirmed reservations (in cents, convert to dollars)
    const totalEarnings =
      confirmedReservations?.reduce((sum: number, res: { totalAmount?: number }) => sum + (res.totalAmount || 0), 0) || 0

    // Get average rating from review stats
    const averageRating = reviewStats?.averageRating || 0

    // Calculate analytics totals
    const totalViews = vehicleAnalytics?.reduce((sum: number, v: { totalViews: number }) => sum + v.totalViews, 0) || 0
    const totalShares = vehicleAnalytics?.reduce((sum: number, v: { totalShares: number }) => sum + v.totalShares, 0) || 0
    const totalFavorites = vehicleAnalytics?.reduce((sum: number, v: { favoriteCount: number }) => sum + v.favoriteCount, 0) || 0

    return {
      totalVehicles,
      pendingBookings,
      upcomingBookings,
      totalEarnings: Math.round(totalEarnings / 100), // Convert cents to dollars
      averageRating,
      totalViews,
      totalShares,
      totalFavorites,
    }
  }, [vehicles, pendingReservations, confirmedReservations, reviewStats, vehicleAnalytics])


  // Map recent vehicles from real data
  const recentVehicles = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return []

    return vehicles.slice(0, 3).map((vehicle: { _id: string; images?: Array<{ isPrimary: boolean; cardUrl?: string }>; make: string; model: string; year: number; isApproved?: boolean; isActive?: boolean; dailyRate?: number }) => {
      const primaryImage = vehicle.images?.find((img: { isPrimary: boolean }) => img.isPrimary) || vehicle.images?.[0]

      // Calculate bookings and earnings from reservations
      const vehicleReservations = [
        ...(pendingReservations || []),
        ...(confirmedReservations || []),
      ].filter((res) => res.vehicleId === vehicle._id)

      const bookings = vehicleReservations.length
      const earnings = vehicleReservations.reduce(
        (sum, res) => sum + Math.round((res.totalAmount || 0) / 100),
        0
      )

      const status = vehicle.isApproved ? "active" : vehicle.isActive ? "pending" : "inactive"

      return {
        id: vehicle._id,
        name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status,
        bookings,
        earnings,
        image: primaryImage?.cardUrl ?? "",
        dailyRate: vehicle.dailyRate,
      }
    })
  }, [vehicles, pendingReservations, confirmedReservations])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-3" />
            Active
          </Badge>
        )
      case "pending":
        return (
          <Badge className="gap-1.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <Clock className="size-3" />
            Pending
          </Badge>
        )
      case "inactive":
        return (
          <Badge className="gap-1.5 bg-gray-500/10 text-gray-700 dark:text-gray-400">
            <XCircle className="size-3" />
            Inactive
          </Badge>
        )
      default:
        return null
    }
  }

  // Helper function to get time ago string
  function getTimeAgo(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }

  // Show loading state while data is being fetched
  const isLoading =
    vehicles === undefined ||
    pendingReservations === undefined ||
    confirmedReservations === undefined ||
    reviewStats === undefined ||
    vehicleAnalytics === undefined

  const handleOnboarding = async () => {
    if (!user?.id) return
    setIsLoadingConnect(true)
    setConnectError(null)
    try {
      const result = await startOrContinueOnboarding({ ownerId: user.id })
      if (result.onboardingUrl) {
        window.location.href = result.onboardingUrl
        return
      }
      const status = await fetchConnectStatus({ ownerId: user.id })
      setConnectStatus(status)
    } catch (error) {
      handleError(error, { showToast: false })
      const errorMessage = "Failed to start Stripe onboarding. Please try again."
      setConnectError(errorMessage)
    } finally {
      setIsLoadingConnect(false)
    }
  }

  const handleOpenDashboard = async () => {
    if (!user?.id) return
    setIsLoadingConnect(true)
    setConnectError(null)
    try {
      const link = await createDashboardLink({ ownerId: user.id })
      if (link.url) {
        window.location.href = link.url
      }
    } catch (error) {
      handleError(error, { showToast: false })
      const errorMessage = "Failed to open Stripe dashboard. Please try again."
      setConnectError(errorMessage)
    } finally {
      setIsLoadingConnect(false)
    }
  }

  // Show loading or redirect if onboarding not complete
  if (isLoading || !onboardingStatus) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (onboardingStatus.status !== "completed") {
    return null // Will redirect via useEffect
  }

  return (
    <>
      <HostOnboardingChecklist onOpenChange={setShowChecklist} open={showChecklist} />
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Stripe Account Setup Banner */}
        {connectStatus && !connectStatus.isComplete && (
          <Card className="mb-6 border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <CardTitle className="text-amber-900 dark:text-amber-100">
                      Complete Your Stripe Account Setup
                    </CardTitle>
                    <CardDescription className="mt-1.5 text-amber-800 dark:text-amber-200">
                      {connectStatus.hasAccount
                        ? "Your Stripe account is not fully set up. Your vehicles will not be displayed to renters until you complete the onboarding process. Complete setup to display your vehicles and start receiving payouts."
                        : "Your vehicles will not be displayed to renters until you complete Stripe account setup. Set up your account to display your vehicles and receive payouts from your rentals. This only takes a few minutes."}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  disabled={isLoadingConnect || !user?.id}
                  onClick={handleOnboarding}
                  size="lg"
                  className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                >
                  {isLoadingConnect ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Working...
                    </>
                  ) : (
                    <>
                      {connectStatus.hasAccount ? "Continue Setup" : "Set Up Payouts"}
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Header Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h1 className="font-bold text-3xl sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-muted-foreground">
              Welcome back, {user?.firstName || "Host"}. Here's what's happening with your listings.
            </p>
          </div>

          {/* Key Metrics - Hero Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-medium text-sm text-muted-foreground">
                  Pending Bookings
                </CardTitle>
                <Clock className="size-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="font-bold text-3xl">{stats.pendingBookings}</div>
                <p className="mt-1 text-xs text-muted-foreground">Require your attention</p>
                {stats.pendingBookings > 0 && (
                  <Link href="/host/reservations?status=pending">
                    <Button className="mt-3 w-full" size="sm" variant="outline">
                      Review Now
                      <ArrowRight className="ml-2 size-3" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-medium text-sm text-muted-foreground">
                  Total Earnings
                </CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-bold text-3xl">${stats.totalEarnings.toLocaleString()}</div>
                <p className="mt-1 text-xs text-muted-foreground">All-time revenue</p>
                {connectStatus && !connectStatus.isComplete && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Complete Stripe setup to receive payouts
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-medium text-sm text-muted-foreground">
                  Active Vehicles
                </CardTitle>
                <Car className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="font-bold text-3xl">{stats.totalVehicles}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vehicles?.filter((v: { isApproved?: boolean; isActive?: boolean }) => v.isApproved && v.isActive).length || 0} approved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-medium text-sm text-muted-foreground">
                  Average Rating
                </CardTitle>
                <Star className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="font-bold text-3xl">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
                  </div>
                  {stats.averageRating > 0 && (
                    <div className="flex items-center gap-0.5 text-yellow-500">
                      <Star className="size-4 fill-current" />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviewStats?.totalReviews || 0} reviews
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pending Bookings - Priority Section */}
            {stats.pendingBookings > 0 && (
              <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="size-5 text-yellow-600 dark:text-yellow-400" />
                        Action Required
                      </CardTitle>
                      <CardDescription className="mt-1">
                        You have {stats.pendingBookings} booking{" "}
                        {stats.pendingBookings === 1 ? "request" : "requests"} waiting for your
                        response
                      </CardDescription>
                    </div>
                    <Link href="/host/reservations?status=pending">
                      <Button variant="outline">
                        View All
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingReservations?.slice(0, 3).map((reservation: { _id: string; createdAt: number; totalAmount?: number; vehicle?: { year: number; make: string; model: string; images?: Array<{ isPrimary: boolean; cardUrl?: string }> }; renter?: { name?: string } }) => {
                      const vehicleName = reservation.vehicle
                        ? `${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`
                        : "Vehicle"
                      const renterName = reservation.renter?.name || "Guest"
                      const primaryImage =
                        reservation.vehicle?.images?.find((img: { isPrimary: boolean }) => img.isPrimary) ||
                        reservation.vehicle?.images?.[0]

                      const hasImage = primaryImage?.cardUrl

                      return (
                        <Link
                          key={reservation._id}
                          href={`/host/reservations/${reservation._id}`}
                        >
                          <div className="flex items-center gap-4 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50">
                            <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              {hasImage && primaryImage?.cardUrl ? (
                                <Image
                                  alt={vehicleName}
                                  className="object-cover"
                                  fill
                                  sizes="64px"
                                  src={primaryImage.cardUrl}
                                />
                              ) : (
                                <Car className="size-6 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{vehicleName}</p>
                              <p className="text-muted-foreground text-xs">
                                {renterName} • {getTimeAgo(reservation.createdAt)}
                              </p>
                              <p className="mt-1 font-semibold text-sm">
                                ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                              </p>
                            </div>
                            <Button size="sm">Review</Button>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Your Vehicles */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Vehicles</CardTitle>
                  <CardDescription className="mt-1">
                    Manage your listings and track performance
                  </CardDescription>
                </div>
                <Link href="/host/vehicles/list">
                  <Button size="sm" variant="outline">
                    View All
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {recentVehicles.length === 0 ? (
                  <div className="py-12 text-center">
                    <Car className="mx-auto mb-4 size-12 text-muted-foreground" />
                    <p className="mb-2 font-semibold text-lg">No vehicles yet</p>
                    <p className="mb-6 text-muted-foreground text-sm">
                      List your first vehicle to start earning
                    </p>
                    <Link href="/host/vehicles/new">
                      <Button>
                        <Plus className="mr-2 size-4" />
                        List Your Vehicle
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-1">
                    {recentVehicles.map((vehicle: { id: string; name: string; image?: string; status?: string; year: number; make: string; model: string; dailyRate?: number; bookings: number; earnings: number }) => (
                      <Link key={vehicle.id} href={`/host/vehicles/${vehicle.id}`}>
                        <Card className="group overflow-hidden transition-all hover:shadow-lg">
                          <div className="flex flex-col sm:flex-row">
                            {/* Vehicle Image - Larger and more prominent */}
                            <div className="relative flex h-48 w-full shrink-0 items-center justify-center overflow-hidden bg-muted sm:h-auto sm:w-48">
                              {vehicle.image && vehicle.image.trim() !== "" ? (
                                <>
                                  <Image
                                    alt={vehicle.name}
                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                    fill
                                    sizes="(max-width: 640px) 100vw, 192px"
                                    src={vehicle.image || ""}
                                  />
                                  {/* Status badge overlay */}
                                  <div className="absolute top-3 left-3">
                                    {getStatusBadge(vehicle.status || "")}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex flex-col items-center gap-2 text-center">
                                    <Car className="size-12 text-muted-foreground/40" />
                                    <p className="text-muted-foreground text-xs">No image</p>
                                  </div>
                                  {/* Status badge overlay */}
                                  <div className="absolute top-3 left-3">
                                    {getStatusBadge(vehicle.status || "")}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Vehicle Details */}
                            <div className="flex flex-1 flex-col p-6">
                              <div className="mb-4 flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="mb-2 font-bold text-xl">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                  </h3>

                                  {/* Key Metrics - Better organized */}
                                  <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                                    <div>
                                      <p className="text-muted-foreground text-xs">Daily Rate</p>
                                      <p className="font-semibold text-base">
                                        ${vehicle.dailyRate.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs">Total Bookings</p>
                                      <p className="font-semibold text-base">{vehicle.bookings}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs">Total Earned</p>
                                      <p className="font-semibold text-base text-primary">
                                        ${vehicle.earnings.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription className="mt-1">How your listings are performing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground text-sm">Total Views</span>
                      <Eye className="size-4 text-muted-foreground" />
                    </div>
                    <div className="font-bold text-2xl">{stats.totalViews.toLocaleString()}</div>
                    <p className="text-muted-foreground text-xs mt-1">Listing views</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground text-sm">Total Shares</span>
                      <Share2 className="size-4 text-muted-foreground" />
                    </div>
                    <div className="font-bold text-2xl">{stats.totalShares.toLocaleString()}</div>
                    <p className="text-muted-foreground text-xs mt-1">Times shared</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground text-sm">Total Favorites</span>
                      <Heart className="size-4 text-muted-foreground" />
                    </div>
                    <div className="font-bold text-2xl">{stats.totalFavorites.toLocaleString()}</div>
                    <p className="text-muted-foreground text-xs mt-1">Saved by users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Host Hub - Prominent Actions */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Host Hub</CardTitle>
                <CardDescription className="mt-1">Quick access to manage your business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link className="block" href="/host/reservations">
                  <Button className="w-full justify-start" size="lg" variant="default">
                    <Calendar className="mr-3 size-5" />
                    <span className="font-semibold">All Reservations</span>
                    <div className="ml-auto flex items-center gap-2">
                      {stats.pendingBookings > 0 && (
                        <Badge variant="destructive">
                          {stats.pendingBookings}
                        </Badge>
                      )}
                      <ArrowRight className="size-4" />
                    </div>
                  </Button>
                </Link>
                <Link className="block" href="/host/vehicles/list">
                  <Button className="w-full justify-start" size="lg" variant="default">
                    <Car className="mr-3 size-5" />
                    <span className="font-semibold">Manage Vehicles</span>
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                </Link>
                <Link className="block" href="/messages">
                  <Button className="w-full justify-start" size="lg" variant="default">
                    <MessageSquare className="mr-3 size-5" />
                    <span className="font-semibold">Messages</span>
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                </Link>
                <Link className="block" href="/host/vehicles/new">
                  <Button className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90" size="lg">
                    <Plus className="mr-3 size-5" />
                    <span className="font-semibold">List New Vehicle</span>
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Payments & Payouts */}
            <Card>
              <CardHeader>
                <CardTitle>Payments & Payouts</CardTitle>
                <CardDescription className="mt-1">Manage your Stripe account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectError && (
                  <p className="text-destructive text-sm" role="alert">
                    {connectError}
                  </p>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Account Status</span>
                    </div>
                    {connectStatus?.isComplete ? (
                      <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="size-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge className="gap-1.5 bg-red-500/10 text-red-700 dark:text-red-400" variant="secondary">
                        <XCircle className="size-3" />
                        Not Set Up
                      </Badge>
                    )}
                  </div>
                  {connectStatus?.isComplete && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Payouts</span>
                      </div>
                      {connectStatus?.payoutsEnabled ? (
                        <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="size-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge className="gap-1.5" variant="secondary">
                          <Clock className="size-3" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  )}
                  {connectStatus && !connectStatus.isComplete && (
                    <p className="text-muted-foreground text-xs">
                      Complete setup to receive payouts from your rentals
                    </p>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                  <Button
                    disabled={isLoadingConnect || !user?.id}
                    onClick={handleOnboarding}
                    size="sm"
                    className={
                      connectStatus && !connectStatus.isComplete
                        ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                        : ""
                    }
                  >
                    {isLoadingConnect
                      ? "Working..."
                      : connectStatus?.isComplete
                        ? "Manage Account"
                        : "Set Up Payouts"}
                  </Button>
                  {connectStatus?.isComplete && (
                    <Button
                      disabled={isLoadingConnect || !user?.id}
                      onClick={handleOpenDashboard}
                      variant="outline"
                      size="sm"
                    >
                      Stripe Dashboard
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </>
  )
}
