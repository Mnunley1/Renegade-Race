"use client"

import { useUser } from "@clerk/nextjs"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
  XCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { HostOnboardingChecklist } from "@/components/host-onboarding-checklist"
import { api } from "@/lib/convex"
import { handleError } from "@/lib/error-handler"
import { r2Url } from "@/lib/r2-url"

function HostDashboardContent() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false)

  const fetchConnectStatus = useAction(api.stripe.getConnectAccountStatus)
  const refreshConnectStatus = useAction(api.stripe.refreshConnectAccountStatus)
  const startOrContinueOnboarding = useAction(api.stripe.createConnectAccount)
  const createDashboardLink = useAction(api.stripe.createConnectLoginLink)

  // Check onboarding status
  const onboardingStatus = useQuery(api.users.getHostOnboardingStatus, user?.id ? {} : "skip")
  const platformFee = useQuery(api.users.getMyPlatformFee, user?.id ? {} : "skip")

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

  // Handle Stripe return/refresh query parameters
  useEffect(() => {
    const stripeReturn = searchParams.get("stripe_return")
    const stripeRefresh = searchParams.get("stripe_refresh")

    if ((stripeReturn || stripeRefresh) && !stripeReturnHandled) {
      setStripeReturnHandled(true)

      // Clean up the URL by removing stripe params
      const url = new URL(window.location.href)
      url.searchParams.delete("stripe_return")
      url.searchParams.delete("stripe_refresh")
      router.replace(url.pathname + url.search, { scroll: false })

      if (stripeRefresh) {
        // User needs to restart onboarding (link expired)
        toast.info("Your Stripe session expired. Please try again.")
      }
      // For stripe_return, we'll show success/status after loading account status below
    }
  }, [searchParams, stripeReturnHandled, router])

  useEffect(() => {
    const loadStatus = async () => {
      if (!user?.id) return
      setIsLoadingConnect(true)
      setConnectError(null)
      try {
        // First, refresh the Stripe account status in our database to sync with Stripe
        // This ensures our database reflects the current Stripe account state
        await refreshConnectStatus({ ownerId: user.id }).catch(() => {
          // Silently ignore refresh errors - we'll still try to fetch status
        })

        const status = await fetchConnectStatus({ ownerId: user.id })
        setConnectStatus(status)

        // Show toast if returning from Stripe onboarding
        if (stripeReturnHandled && status) {
          if (status.isComplete) {
            toast.success("Your Stripe account is set up! You can now receive payments.")
          } else if (status.hasAccount) {
            toast.info(
              "Stripe setup incomplete. Please complete the remaining steps to receive payments."
            )
          }
        }
      } catch (error) {
        handleError(error, { showToast: false })
        const errorMessage = "Failed to load payout status"
        setConnectError(errorMessage)
      } finally {
        setIsLoadingConnect(false)
      }
    }

    loadStatus()
  }, [fetchConnectStatus, refreshConnectStatus, user?.id, stripeReturnHandled])

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalVehicles = vehicles?.length || 0
    const pendingBookings = pendingReservations?.length || 0
    const upcomingBookings = confirmedReservations?.length || 0

    // Calculate total earnings from confirmed reservations (in cents, convert to dollars)
    const totalEarnings =
      confirmedReservations?.reduce(
        (sum: number, res: { totalAmount?: number }) => sum + (res.totalAmount || 0),
        0
      ) || 0

    // Get average rating from review stats
    const averageRating = reviewStats?.averageRating || 0

    // Calculate analytics totals
    const totalViews =
      vehicleAnalytics?.reduce((sum: number, v: { totalViews: number }) => sum + v.totalViews, 0) ||
      0
    const totalShares =
      vehicleAnalytics?.reduce(
        (sum: number, v: { totalShares: number }) => sum + v.totalShares,
        0
      ) || 0
    const totalFavorites =
      vehicleAnalytics?.reduce(
        (sum: number, v: { favoriteCount: number }) => sum + v.favoriteCount,
        0
      ) || 0

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

    return vehicles
      .slice(0, 3)
      .map(
        (vehicle: {
          _id: string
          images?: Array<{ isPrimary: boolean; cardUrl?: string; r2Key?: string }>
          make: string
          model: string
          year: number
          isApproved?: boolean
          isActive?: boolean
          dailyRate?: number
        }) => {
          const primaryImage =
            vehicle.images?.find((img: { isPrimary: boolean }) => img.isPrimary) ||
            vehicle.images?.[0]

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
            imageKey: primaryImage?.r2Key ?? "",
            dailyRate: vehicle.dailyRate,
          }
        }
      )
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
    const minutes = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)

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
      // Pass the current origin so redirects work with any domain (localhost, ngrok, staging, production)
      const returnUrlBase = typeof window !== "undefined" ? window.location.origin : undefined

      const result = await startOrContinueOnboarding({
        ownerId: user.id,
        returnUrlBase, // Pass current domain for flexible redirects
      })
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

  const approvedVehicleCount =
    vehicles?.filter(
      (v: { isApproved?: boolean; isActive?: boolean }) => v.isApproved && v.isActive
    ).length || 0

  return (
    <>
      <HostOnboardingChecklist onOpenChange={setShowChecklist} open={showChecklist} />
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-1.5 text-muted-foreground">
              Welcome back, {user?.firstName || "Host"}.
            </p>
          </div>
          <Link href="/host/vehicles/new">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              List New Vehicle
            </Button>
          </Link>
        </div>

        {platformFee?.isEarlyAdopter && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="font-medium text-emerald-900 text-sm dark:text-emerald-100">
              Early adopter
            </p>
            <p className="mt-0.5 text-emerald-800 text-sm dark:text-emerald-200">
              Your platform fee is capped at {platformFee.platformFeeCapPercentage ?? 3}%. You
              currently pay {platformFee.effectiveFeePercentage}% (never higher than your cap; lower
              if the global rate drops).
            </p>
          </div>
        )}

        {/* Stripe Account Setup Banner - slim, single row */}
        {connectStatus && !connectStatus.isComplete && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-amber-900 text-sm dark:text-amber-100">
                <span className="font-semibold">Finish setting up payouts.</span> Your vehicles stay
                hidden from renters until your Stripe account is complete.
              </p>
            </div>
            <Button
              className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              disabled={isLoadingConnect || !user?.id}
              onClick={handleOnboarding}
              size="sm"
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
        )}

        {/* Key Metrics - flat, uniform KPI cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Pending</span>
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 font-bold text-3xl tracking-tight">{stats.pendingBookings}</div>
              <p className="mt-1 text-muted-foreground text-xs">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Earnings</span>
                <DollarSign className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 font-bold text-3xl tracking-tight">
                ${stats.totalEarnings.toLocaleString()}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">All-time revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Vehicles</span>
                <Car className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 font-bold text-3xl tracking-tight">{stats.totalVehicles}</div>
              <p className="mt-1 text-muted-foreground text-xs">{approvedVehicleCount} approved</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Rating</span>
                <Star className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <div className="font-bold text-3xl tracking-tight">
                  {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
                </div>
                {stats.averageRating > 0 && (
                  <Star className="size-4 fill-yellow-500 text-yellow-500" />
                )}
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                {reviewStats?.totalReviews || 0} reviews
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Pending Bookings - the single "needs attention" zone */}
            {stats.pendingBookings > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Needs your attention</CardTitle>
                    <CardDescription className="mt-1">
                      {stats.pendingBookings} booking{" "}
                      {stats.pendingBookings === 1 ? "request" : "requests"} awaiting your response
                    </CardDescription>
                  </div>
                  <Link href="/host/reservations?status=pending">
                    <Button size="sm" variant="ghost">
                      View all
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pendingReservations?.slice(0, 3).map((reservation: any) => {
                      const vehicleName = reservation.vehicle
                        ? `${reservation.vehicle.year} ${reservation.vehicle.make} ${reservation.vehicle.model}`
                        : "Vehicle"
                      const renterName = reservation.renter?.name || "Guest"
                      const primaryImage =
                        reservation.vehicle?.images?.find(
                          (img: { isPrimary: boolean }) => img.isPrimary
                        ) || reservation.vehicle?.images?.[0]

                      const primaryImageKey = primaryImage?.r2Key

                      return (
                        <Link href={`/host/reservations/${reservation._id}`} key={reservation._id}>
                          <div className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-muted/50">
                            <div className="relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              {primaryImageKey ? (
                                <Image
                                  alt={vehicleName}
                                  className="object-cover"
                                  fill
                                  quality={75}
                                  sizes="144px"
                                  src={r2Url(primaryImageKey)}
                                />
                              ) : (
                                <Car className="size-8 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-sm">{vehicleName}</p>
                              <p className="text-muted-foreground text-xs">
                                {renterName} • {getTimeAgo(reservation.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-sm">
                                ${Math.round((reservation.totalAmount || 0) / 100).toLocaleString()}
                              </p>
                              <span className="text-muted-foreground text-xs">Review →</span>
                            </div>
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
                <CardTitle>Your vehicles</CardTitle>
                <Link href="/host/vehicles/list">
                  <Button size="sm" variant="ghost">
                    View all
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
                  <div className="space-y-2">
                    {recentVehicles.map(
                      (vehicle: {
                        id: string
                        name: string
                        imageKey?: string
                        status?: string
                        year: number
                        make: string
                        model: string
                        dailyRate?: number
                        bookings: number
                        earnings: number
                      }) => (
                        <Link href={`/host/vehicles/${vehicle.id}`} key={vehicle.id}>
                          <div className="flex items-center gap-4 rounded-lg p-2 transition-colors hover:bg-muted/50">
                            <div className="relative flex h-32 w-48 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              {vehicle.imageKey && vehicle.imageKey.trim() !== "" ? (
                                <Image
                                  alt={vehicle.name}
                                  className="object-cover"
                                  fill
                                  quality={80}
                                  sizes="192px"
                                  src={r2Url(vehicle.imageKey)}
                                />
                              ) : (
                                <Car className="size-10 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-semibold text-sm">
                                  {vehicle.year} {vehicle.make} {vehicle.model}
                                </p>
                                {getStatusBadge(vehicle.status || "")}
                              </div>
                              <p className="mt-0.5 text-muted-foreground text-xs">
                                ${vehicle.dailyRate?.toLocaleString() ?? "0"}/day •{" "}
                                {vehicle.bookings} booking{vehicle.bookings === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-primary text-sm">
                                ${vehicle.earnings.toLocaleString()}
                              </p>
                              <span className="text-muted-foreground text-xs">earned</span>
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick actions - lightweight nav */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Link className="block" href="/host/reservations">
                  <Button className="w-full justify-start font-normal" variant="ghost">
                    <Calendar className="mr-3 size-4 text-muted-foreground" />
                    Reservations
                    <div className="ml-auto flex items-center gap-2">
                      {stats.pendingBookings > 0 && (
                        <Badge variant="destructive">{stats.pendingBookings}</Badge>
                      )}
                    </div>
                  </Button>
                </Link>
                <Link className="block" href="/host/vehicles/list">
                  <Button className="w-full justify-start font-normal" variant="ghost">
                    <Car className="mr-3 size-4 text-muted-foreground" />
                    Manage vehicles
                  </Button>
                </Link>
                <Link className="block" href="/messages">
                  <Button className="w-full justify-start font-normal" variant="ghost">
                    <MessageSquare className="mr-3 size-4 text-muted-foreground" />
                    Messages
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Performance - quiet inline strip */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 divide-x">
                  <div className="px-2 text-center first:pl-0">
                    <Eye className="mx-auto size-4 text-muted-foreground" />
                    <div className="mt-1.5 font-bold text-xl">
                      {stats.totalViews.toLocaleString()}
                    </div>
                    <p className="text-muted-foreground text-xs">Views</p>
                  </div>
                  <div className="px-2 text-center">
                    <Share2 className="mx-auto size-4 text-muted-foreground" />
                    <div className="mt-1.5 font-bold text-xl">
                      {stats.totalShares.toLocaleString()}
                    </div>
                    <p className="text-muted-foreground text-xs">Shares</p>
                  </div>
                  <div className="px-2 text-center">
                    <Heart className="mx-auto size-4 text-muted-foreground" />
                    <div className="mt-1.5 font-bold text-xl">
                      {stats.totalFavorites.toLocaleString()}
                    </div>
                    <p className="text-muted-foreground text-xs">Saved</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payments & Payouts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payments & payouts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectError && (
                  <p className="text-destructive text-sm" role="alert">
                    {connectError}
                  </p>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Account</span>
                    {connectStatus?.isComplete ? (
                      <Badge className="gap-1.5 bg-green-500/10 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="size-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge
                        className="gap-1.5 bg-red-500/10 text-red-700 dark:text-red-400"
                        variant="secondary"
                      >
                        <XCircle className="size-3" />
                        Not set up
                      </Badge>
                    )}
                  </div>
                  {connectStatus?.isComplete && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Payouts</span>
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
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    className={
                      connectStatus && !connectStatus.isComplete
                        ? "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                        : ""
                    }
                    disabled={isLoadingConnect || !user?.id}
                    onClick={handleOnboarding}
                    size="sm"
                    variant={connectStatus?.isComplete ? "outline" : "default"}
                  >
                    {isLoadingConnect
                      ? "Working..."
                      : connectStatus?.isComplete
                        ? "Manage account"
                        : "Set up payouts"}
                  </Button>
                  {connectStatus?.isComplete && (
                    <Button
                      disabled={isLoadingConnect || !user?.id}
                      onClick={handleOpenDashboard}
                      size="sm"
                      variant="ghost"
                    >
                      Open Stripe dashboard
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

export default function HostDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 size-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      }
    >
      <HostDashboardContent />
    </Suspense>
  )
}
