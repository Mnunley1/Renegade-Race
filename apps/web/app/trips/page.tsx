"use client"

import { useQuery } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Calendar } from "lucide-react"
import Link from "next/link"
import { TripCard } from "@/components/trip-card"
import { api } from "@/lib/convex"
import { useMemo } from "react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"

export default function TripsPage() {
  const { user } = useUser()
  
  // Fetch user's reservations from Convex (as renter)
  const reservationsData = useQuery(
    api.reservations.getByUser,
    user?.id ? { userId: user.id, role: "renter" as const } : "skip"
  )

  // Map reservations to trips format
  const upcomingTrips = useMemo(() => {
    if (!reservationsData) return []
    const today = new Date().toISOString().split('T')[0]
    return reservationsData
      .filter((res) => res.status === "confirmed" && res.endDate >= today)
      .map((res) => {
        const vehicle = res.vehicle
        if (!vehicle) return null
        const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
        return {
          reservationId: res._id,
          vehicleId: vehicle._id,
          vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          vehicleImage: primaryImage?.cardUrl || primaryImage?.imageUrl || "",
          vehicleYear: vehicle.year,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          location: vehicle.track?.location || vehicle.track?.name || "Location TBD",
          startDate: res.startDate,
          endDate: res.endDate,
          pickupTime: res.pickupTime,
          dropoffTime: res.dropoffTime,
          totalDays: res.totalDays,
          dailyRate: res.dailyRate,
          totalAmount: res.totalAmount,
          status: res.status,
          addOns: res.addOns,
        }
      })
      .filter(Boolean) as Array<{
        reservationId: Id<"reservations">
        vehicleId: Id<"vehicles">
        vehicleName: string
        vehicleImage: string
        vehicleYear: number
        vehicleMake: string
        vehicleModel: string
        location: string
        startDate: string
        endDate: string
        pickupTime?: string
        dropoffTime?: string
        totalDays: number
        dailyRate: number
        totalAmount: number
        status: "pending" | "confirmed" | "cancelled" | "completed" | "declined"
        addOns?: Array<{ name: string; price: number; description?: string }>
      }>
  }, [reservationsData])

  const pastTrips = useMemo(() => {
    if (!reservationsData) return []
    const today = new Date().toISOString().split('T')[0]
    return reservationsData
      .filter((res) => res.status === "completed" || (res.endDate < today && res.status === "confirmed"))
      .map((res) => {
        const vehicle = res.vehicle
        if (!vehicle) return null
        const primaryImage = vehicle.images?.find((img) => img.isPrimary) || vehicle.images?.[0]
        return {
          reservationId: res._id,
          vehicleId: vehicle._id,
          vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          vehicleImage: primaryImage?.cardUrl || primaryImage?.imageUrl || "",
          vehicleYear: vehicle.year,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          location: vehicle.track?.location || vehicle.track?.name || "Location TBD",
          startDate: res.startDate,
          endDate: res.endDate,
          pickupTime: res.pickupTime,
          dropoffTime: res.dropoffTime,
          totalDays: res.totalDays,
          dailyRate: res.dailyRate,
          totalAmount: res.totalAmount,
          status: res.status,
          addOns: res.addOns,
        }
      })
      .filter(Boolean) as Array<{
        reservationId: Id<"reservations">
        vehicleId: Id<"vehicles">
        vehicleName: string
        vehicleImage: string
        vehicleYear: number
        vehicleMake: string
        vehicleModel: string
        location: string
        startDate: string
        endDate: string
        pickupTime?: string
        dropoffTime?: string
        totalDays: number
        dailyRate: number
        totalAmount: number
        status: "pending" | "confirmed" | "cancelled" | "completed" | "declined"
        addOns?: Array<{ name: string; price: number; description?: string }>
      }>
  }, [reservationsData])


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-3xl">My Trips</h1>
        <p className="text-muted-foreground">
          Manage your upcoming reservations and review past experiences
        </p>
      </div>

      <div className="space-y-8">
        {/* Upcoming Trips Section */}
        <div>
          <h2 className="mb-4 font-semibold text-xl">Upcoming Trips</h2>
          {upcomingTrips.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="mb-2 font-semibold text-lg">No upcoming trips</p>
                <p className="mb-6 text-muted-foreground">
                  Start planning your next track adventure
                </p>
                <Link href="/vehicles">
                  <Button>Browse Vehicles</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {upcomingTrips.map((trip) => (
                <TripCard key={trip.reservationId} {...trip} />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Past Trips Section */}
        <div>
          <h2 className="mb-4 font-semibold text-xl">Past Trips</h2>
          {pastTrips.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto mb-4 size-12 text-muted-foreground" />
                <p className="text-muted-foreground">No past trips</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              {pastTrips.map((trip) => (
                <TripCard key={trip.reservationId} {...trip} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
