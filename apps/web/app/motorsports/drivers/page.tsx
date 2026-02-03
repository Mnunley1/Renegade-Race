"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useQuery } from "convex/react"
import { ArrowLeft, MapPin, Plus, Search, Settings, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { DriverCard } from "@/components/driver-card"
import { useDebounce } from "@/hooks/useDebounce"
import { api } from "@/lib/convex"
import { MotorsportsNav } from "../_components/motorsports-nav"

const ITEMS_PER_PAGE = 12

export default function DriversPage() {
  const [racingTypeFilter, setRacingTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [experienceFilter, setExperienceFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const driversData = useQuery(api.driverProfiles.list, {
    racingType:
      racingTypeFilter !== "all"
        ? (racingTypeFilter as "real-world" | "sim-racing" | "both")
        : undefined,
    location: locationFilter || undefined,
    experience:
      experienceFilter !== "all"
        ? (experienceFilter as "beginner" | "intermediate" | "advanced" | "professional")
        : undefined,
  })

  const userDriverProfile = useQuery(api.driverProfiles.getByUser)

  const allDrivers = useMemo(() => {
    if (!driversData) return []
    return driversData.map((driver: any) => ({
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

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    allDrivers.forEach((driver: any) => locations.add(driver.location))
    return Array.from(locations).sort()
  }, [allDrivers])

  const drivers = useMemo(() => {
    let filtered = allDrivers

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (driver: any) =>
          driver.name.toLowerCase().includes(query) ||
          driver.location.toLowerCase().includes(query) ||
          driver.bio?.toLowerCase().includes(query) ||
          driver.headline?.toLowerCase().includes(query) ||
          driver.preferredCategories.some((cat: string) => cat.toLowerCase().includes(query)) ||
          driver.licenses.some((license: string) => license.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [allDrivers, debouncedSearchQuery])

  const paginatedDrivers = drivers.slice(0, page * ITEMS_PER_PAGE)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery, racingTypeFilter, locationFilter, experienceFilter])

  const hasActiveFilters =
    racingTypeFilter !== "all" ||
    debouncedSearchQuery.trim() !== "" ||
    locationFilter !== "" ||
    experienceFilter !== "all"

  const resetFilters = () => {
    setSearchQuery("")
    setLocationFilter("")
    setRacingTypeFilter("all")
    setExperienceFilter("all")
    setPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports">
        <Button className="mb-4" variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Motorsports Hub
        </Button>
      </Link>

      <MotorsportsNav />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-2xl">Drivers</h1>
        {userDriverProfile && userDriverProfile.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/motorsports/drivers/${userDriverProfile[0]!._id}`}>
              <Settings className="mr-2 size-4" />
              Manage Profile
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href="/motorsports/profile/driver">
              <Plus className="mr-2 size-4" />
              Post Driver Profile
            </Link>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pr-4 pl-10"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search drivers by name, location, specialties..."
            value={searchQuery}
          />
          {searchQuery && (
            <Button
              className="-translate-y-1/2 absolute top-1/2 right-2"
              onClick={() => setSearchQuery("")}
              size="sm"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasActiveFilters && (
            <Button onClick={resetFilters} size="sm" variant="ghost">
              <X className="mr-1 size-3" />
              Clear All
            </Button>
          )}

          <div className="ml-auto flex flex-wrap gap-3">
            <Select onValueChange={setRacingTypeFilter} value={racingTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Racing Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="real-world">Real-World</SelectItem>
                <SelectItem value="sim-racing">Sim Racing</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>

            {uniqueLocations.length > 0 && (
              <Select
                onValueChange={(value) => setLocationFilter(value === "all" ? "" : value)}
                value={locationFilter || "all"}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {uniqueLocations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select onValueChange={setExperienceFilter} value={experienceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Experience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {racingTypeFilter !== "all" && (
              <Badge className="gap-1" variant="secondary">
                {racingTypeFilter === "real-world"
                  ? "Real-World"
                  : racingTypeFilter === "sim-racing"
                    ? "Sim Racing"
                    : "Both"}
                <button
                  aria-label="Remove racing type filter"
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setRacingTypeFilter("all")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {locationFilter && (
              <Badge className="gap-1" variant="secondary">
                <MapPin className="size-3" />
                {locationFilter}
                <button
                  aria-label="Remove location filter"
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setLocationFilter("")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {experienceFilter !== "all" && (
              <Badge className="gap-1" variant="secondary">
                {experienceFilter.charAt(0).toUpperCase() + experienceFilter.slice(1)}
                <button
                  aria-label="Remove experience filter"
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setExperienceFilter("all")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {debouncedSearchQuery && (
              <Badge className="gap-1" variant="secondary">
                <Search className="size-3" />"{debouncedSearchQuery}"
                <button
                  aria-label="Remove search filter"
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {(() => {
              if (driversData === undefined) return "Loading drivers..."
              const driverText = drivers.length === 1 ? "driver" : "drivers"
              return `Showing ${paginatedDrivers.length} of ${drivers.length} ${driverText}`
            })()}
          </p>
        </div>

        {(() => {
          if (driversData === undefined) {
            return (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
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
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {paginatedDrivers.map((driver: any) => (
                  <DriverCard key={driver.id} {...driver} />
                ))}
              </div>
              {paginatedDrivers.length < drivers.length && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                    Load More ({drivers.length - paginatedDrivers.length} remaining)
                  </Button>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
