"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useQuery } from "convex/react"
import { Flag, MapPin, Plus, RefreshCw, Search, Settings, User, Users, Zap, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { DriverCard } from "@/components/driver-card"
import { TeamCard } from "@/components/team-card"
import { useDebounce } from "@/hooks/useDebounce"
import { api } from "@/lib/convex"

function MotorsportsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"drivers" | "teams">("teams")
  const [isMounted, setIsMounted] = useState(false)
  const [racingTypeFilter, setRacingTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [experienceFilter, setExperienceFilter] = useState<string>("all")
  const [minSeatsFilter, setMinSeatsFilter] = useState<string>("all")

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Initialize from URL params after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update tab when URL param changes (after mount)
  useEffect(() => {
    if (!isMounted) return
    const tabParam = searchParams.get("tab")
    if (tabParam === "drivers" || tabParam === "teams") {
      setActiveTab(tabParam)
    }
  }, [searchParams, isMounted])

  // Handle tab change and update URL
  const handleTabChange = (value: string) => {
    const newTab = value as "drivers" | "teams"
    setActiveTab(newTab)
    router.push(`/motorsports?tab=${newTab}`, { scroll: false })
  }

  // Fetch data for both tabs
  const teamsData = useQuery(api.teams.list, {
    racingType:
      racingTypeFilter !== "all"
        ? (racingTypeFilter as "real-world" | "sim-racing" | "both")
        : undefined,
    location: locationFilter || undefined,
  })
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

  // Check if current user has a driver profile
  const userDriverProfile = useQuery(api.driverProfiles.getByUser)

  // Map drivers data
  const allDrivers = useMemo(() => {
    if (!driversData) {
      return []
    }
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

  // Map teams data
  const allTeams = useMemo(() => {
    if (!teamsData) {
      return []
    }
    return teamsData.map((team: any) => ({
      id: team._id as string,
      name: team.name,
      logoUrl: team.logoUrl,
      location: team.location,
      racingType: team.racingType,
      simRacingPlatforms: team.simRacingPlatforms,
      specialties: team.specialties,
      availableSeats: team.availableSeats,
      requirements: team.requirements,
      contactInfo: team.contactInfo,
      description: team.description,
      socialLinks: team.socialLinks,
    }))
  }, [teamsData])

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    allDrivers.forEach((driver: any) => locations.add(driver.location))
    allTeams.forEach((team: any) => locations.add(team.location))
    return Array.from(locations).sort()
  }, [allDrivers, allTeams])

  // Apply client-side text search and additional filters
  const drivers = useMemo(() => {
    let filtered = allDrivers

    // Text search
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

    // Min seats filter doesn't apply to drivers
    return filtered
  }, [allDrivers, debouncedSearchQuery])

  const teams = useMemo(() => {
    let filtered = allTeams

    // Text search
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (team: any) =>
          team.name.toLowerCase().includes(query) ||
          team.location.toLowerCase().includes(query) ||
          team.description?.toString().toLowerCase().includes(query) ||
          team.specialties.some((spec: string) => spec.toLowerCase().includes(query)) ||
          (team.requirements &&
            team.requirements.some((req: string) => req.toLowerCase().includes(query)))
      )
    }

    // Min seats filter
    if (minSeatsFilter !== "all") {
      const minSeats = Number.parseInt(minSeatsFilter, 10)
      filtered = filtered.filter((team: any) => team.availableSeats >= minSeats)
    }

    return filtered
  }, [allTeams, debouncedSearchQuery, minSeatsFilter])

  const teamCount = teams.length
  const driverCount = drivers.length

  // Prevent hydration mismatch by not rendering Radix components until mounted
  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if any filters are active
  const hasActiveFilters =
    racingTypeFilter !== "all" ||
    debouncedSearchQuery.trim() !== "" ||
    locationFilter !== "" ||
    experienceFilter !== "all" ||
    minSeatsFilter !== "all"

  // Reset filters function
  const resetFilters = () => {
    setSearchQuery("")
    setLocationFilter("")
    setRacingTypeFilter("all")
    setExperienceFilter("all")
    setMinSeatsFilter("all")
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Enhanced Hero Section */}
      <div className="mb-12">
        <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg transition-shadow hover:shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <CardContent className="relative p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Badge className="px-4 py-1.5 font-semibold text-sm shadow-sm">
                    <Flag className="mr-1.5 inline size-4" />
                    Motorsports Network
                  </Badge>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Users className="size-4" />
                    <span className="font-medium">{teamCount} Teams</span>
                    <span>•</span>
                    <User className="size-4" />
                    <span className="font-medium">{driverCount} Drivers</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="font-bold text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl">
                    Connect Drivers with
                    <span className="block bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      Racing Teams
                    </span>
                  </h1>
                  <p className="text-lg text-muted-foreground leading-relaxed md:text-xl">
                    Find your perfect match and accelerate your racing career in real-world racing
                    or sim racing. Join the premier platform connecting talented drivers with
                    professional racing teams.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button asChild size="lg" className="shadow-md">
                    <Link href="/motorsports/profile/driver">
                      <User className="mr-2 size-4" />
                      Join as Driver
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="shadow-md">
                    <Link href="/motorsports/profile/team">
                      <Users className="mr-2 size-4" />
                      Join as Team
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl shadow-2xl ring-2 ring-primary/20 transition-transform duration-500 group-hover:scale-[1.02]">
                  <Image
                    alt="Motorsports racing"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    fill
                    priority
                    src="/images/christian-palazzolo-UF0QX-zaNXc-unsplash.jpg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute right-4 bottom-4 left-4">
                    <div className="rounded-lg bg-background/90 p-3 backdrop-blur-sm">
                      <p className="font-semibold text-foreground text-sm">
                        Join thousands of drivers and teams connecting on Renegade Motorsports
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-end">
        <div className="flex flex-col gap-2 sm:flex-row">
          {activeTab === "drivers" && userDriverProfile && userDriverProfile.length > 0 ? (
            <Button asChild variant="outline">
              <Link href={`/motorsports/drivers/${userDriverProfile[0]!._id}`}>
                <Settings className="mr-2 size-4" />
                Manage Profile
              </Link>
            </Button>
          ) : activeTab === "drivers" ? (
            <Button asChild variant="outline">
              <Link href="/motorsports/profile/driver">
                <Plus className="mr-2 size-4" />
                Post Driver Profile
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/motorsports/profile/team">
                <Plus className="mr-2 size-4" />
                Post Your Team
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Compact Info Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Flag className="size-5 text-primary" />
            </div>
            <CardTitle className="text-base">For Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Discover racing opportunities with verified teams and showcase your experience.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="size-5 text-primary" />
            </div>
            <CardTitle className="text-base">For Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Find qualified drivers matching your requirements and streamline recruitment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <RefreshCw className="size-5 text-primary" />
            </div>
            <CardTitle className="text-base">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Create your profile, browse opportunities, and connect to take your racing to the next
              level.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pr-4 pl-10"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === "drivers" ? "drivers" : "teams"} by name, location, specialties...`}
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

        {/* Filter Controls */}
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

            {activeTab === "drivers" && (
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
            )}

            {activeTab === "teams" && (
              <Select onValueChange={setMinSeatsFilter} value={minSeatsFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Min Seats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Seats</SelectItem>
                  <SelectItem value="1">1+ Seats</SelectItem>
                  <SelectItem value="2">2+ Seats</SelectItem>
                  <SelectItem value="3">3+ Seats</SelectItem>
                  <SelectItem value="5">5+ Seats</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
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
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setExperienceFilter("all")}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {minSeatsFilter !== "all" && (
              <Badge className="gap-1" variant="secondary">
                {minSeatsFilter}+ Seats
                <button
                  className="ml-1 rounded-full hover:bg-muted"
                  onClick={() => setMinSeatsFilter("all")}
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

      {/* Main Content with Tabs */}
      <Tabs onValueChange={handleTabChange} value={activeTab}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="teams" className="gap-2">
              <Users className="size-4" />
              Teams
              {teamCount > 0 && (
                <Badge className="ml-1" variant="secondary">
                  {teamCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <User className="size-4" />
              Drivers
              {driverCount > 0 && (
                <Badge className="ml-1" variant="secondary">
                  {driverCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Teams Tab */}
        <TabsContent className="space-y-6" value="teams">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {(() => {
                if (teamsData === undefined) {
                  return "Loading teams..."
                }
                const teamText = teams.length === 1 ? "team" : "teams"
                return `Showing ${teams.length} ${teamText}`
              })()}
            </p>
          </div>

          {(() => {
            if (teamsData === undefined) {
              return (
                <div className="flex items-center justify-center py-20">
                  <p className="text-muted-foreground">Loading teams...</p>
                </div>
              )
            }
            if (teams.length === 0) {
              return (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="mb-4 font-semibold text-lg">No teams available</p>
                    <p className="mb-6 text-muted-foreground text-sm">
                      Be the first to post a team looking for drivers!
                    </p>
                    <Button asChild>
                      <Link href="/motorsports/profile/team">
                        <Plus className="mr-2 size-4" />
                        Create Team Profile
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {teams.map((team: any) => (
                  <TeamCard key={team.id} {...team} />
                ))}
              </div>
            )
          })()}
        </TabsContent>

        {/* Drivers Tab */}
        <TabsContent className="space-y-6" value="drivers">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {(() => {
                if (driversData === undefined) {
                  return "Loading drivers..."
                }
                const driverText = drivers.length === 1 ? "driver" : "drivers"
                return `Showing ${drivers.length} ${driverText}`
              })()}
            </p>
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
                {drivers.map((driver: any) => (
                  <DriverCard key={driver.id} {...driver} />
                ))}
              </div>
            )
          })()}
        </TabsContent>
      </Tabs>

      {/* Join the Network CTA - Compact */}
      <Card className="mt-8 bg-muted/50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="mb-1 font-semibold text-lg">Join the Network</h3>
              <p className="text-muted-foreground text-sm">
                Create your profile to connect with drivers and teams in the motorsports community.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" size="sm">
                <Link href="/motorsports/profile/driver">
                  <Plus className="mr-2 size-4" />
                  Create Driver Profile
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/motorsports/profile/team">
                  <Plus className="mr-2 size-4" />
                  Create Team Profile
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MotorsportsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <MotorsportsContent />
    </Suspense>
  )
}
