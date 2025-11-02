"use client"

import { useQuery } from "convex/react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { Calendar } from "lucide-react"
import Link from "next/link"
import { VehicleCard } from "@/components/vehicle-card"
import { api } from "@/lib/convex"
import { useMemo } from "react"

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
          id: res._id,
          image: primaryImage?.cardUrl || primaryImage?.imageUrl || "",
          name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          pricePerDay: vehicle.dailyRate,
          location: vehicle.track?.location || "",
          rating: 0,
          reviews: 0,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        image: string
        name: string
        year: number
        make: string
        model: string
        pricePerDay: number
        location: string
        rating: number
        reviews: number
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
          id: res._id,
          image: primaryImage?.cardUrl || primaryImage?.imageUrl || "",
          name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          pricePerDay: vehicle.dailyRate,
          location: vehicle.track?.location || "",
          rating: 0,
          reviews: 0,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        image: string
        name: string
        year: number
        make: string
        model: string
        pricePerDay: number
        location: string
        rating: number
        reviews: number
      }>
  }, [reservationsData])

  const mockUpcomingTrips: Array<{
    id: string
    image: string
    name: string
    year: number
    make: string
    model: string
    pricePerDay: number
    location: string
  }> = []
  const mockPastTrips = [
    {
      id: "1",
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800",
      name: "Porsche 911 GT3",
      year: 2023,
      make: "Porsche",
      model: "911 GT3",
      pricePerDay: 899,
      location: "Daytona Beach, FL",
      rating: 4.9,
      reviews: 23,
    },
    {
      id: "2",
      image: "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=800",
      name: "Ferrari F8 Tributo",
      year: 2022,
      make: "Ferrari",
      model: "F8 Tributo",
      pricePerDay: 1199,
      location: "Orlando, FL",
      rating: 4.8,
      reviews: 31,
    },
  ]

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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {upcomingTrips.map((trip) => (
                <VehicleCard key={trip.id} {...trip} />
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pastTrips.map((trip) => (
                <VehicleCard key={trip.id} {...trip} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
