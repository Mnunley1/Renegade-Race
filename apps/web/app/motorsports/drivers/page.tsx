"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useQuery } from "convex/react"
import { ArrowLeft, Plus, Settings } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { DriverCard } from "@/components/driver-card"
import { api } from "@/lib/convex"

export default function DriversPage() {
  const [racingTypeFilter, setRacingTypeFilter] = useState<string>("all")

  // Fetch drivers from database
  const driversData = useQuery(api.driverProfiles.list, {
    racingType:
      racingTypeFilter !== "all"
        ? (racingTypeFilter as "real-world" | "sim-racing" | "both")
        : undefined,
  })

  // Check if current user has a driver profile
  const userDriverProfile = useQuery(api.driverProfiles.getByUser)

  // Map drivers data to the format expected by DriverCard
  const drivers = useMemo(() => {
    if (!driversData) {
      return []
    }
    return driversData.map((driver) => ({
      id: driver._id as string,
      name: driver.user?.name || "Unknown Driver",
      avatarUrl: driver.avatarUrl || driver.user?.avatarUrl,
      location: driver.location,
      experience: driver.experience,
      racingType: driver.racingType,
      simRacingPlatforms: driver.simRacingPlatforms,
      simRacingRating: driver.simRacingRating,
      licenses: driver.licenses,
      preferredCategories: driver.preferredCategories,
      headline: driver.headline,
      bio: driver.bio,
    }))
  }, [driversData])

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports">
        <Button className="mb-6" variant="outline">
          <ArrowLeft className="mr-2 size-4" />
          Back to Motorsports
        </Button>
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 font-bold text-3xl">Available Drivers</h1>
          <p className="text-muted-foreground">
            Browse drivers looking for team opportunities. Find talented drivers matching your
            requirements.
          </p>
        </div>
        {userDriverProfile && userDriverProfile.length > 0 ? (
          <Button asChild variant="outline">
            <Link href={`/motorsports/drivers/${userDriverProfile[0]._id}`}>
              <Settings className="mr-2 size-4" />
              Manage Profile
            </Link>
          </Button>
        ) : (
          <Link href="/motorsports/profile/driver">
            <Button variant="outline">
              <Plus className="mr-2 size-4" />
              Post Driver Profile
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {(() => {
            if (driversData === undefined) {
              return "Loading drivers..."
            }
            const driverText = drivers.length === 1 ? "driver" : "drivers"
            return `Showing ${drivers.length} ${driverText}`
          })()}
        </p>
        <Select onValueChange={setRacingTypeFilter} value={racingTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="real-world">Real-World</SelectItem>
            <SelectItem value="sim-racing">Sim Racing</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(() => {
        if (driversData === undefined) {
          return (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading drivers...</p>
            </div>
          )
        }
        if (drivers.length === 0) {
          return (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="mb-4 font-semibold text-lg">No drivers available</p>
                <p className="mb-6 text-muted-foreground text-sm">
                  Be the first to post a driver profile looking for team opportunities!
                </p>
                <Button asChild>
                  <Link href="/motorsports/profile/driver">
                    <Plus className="mr-2 size-4" />
                    Create Driver Profile
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        }
        return (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <DriverCard key={driver.id} {...driver} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
