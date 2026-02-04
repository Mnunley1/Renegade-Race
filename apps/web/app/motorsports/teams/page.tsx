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
import { ArrowLeft, MapPin, Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { TeamCard } from "@/components/team-card"
import { useDebounce } from "@/hooks/useDebounce"
import { api } from "@/lib/convex"
import { MotorsportsNav } from "../_components/motorsports-nav"

const ITEMS_PER_PAGE = 12

export default function TeamsPage() {
  const [racingTypeFilter, setRacingTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [locationFilter, setLocationFilter] = useState<string>("")
  const [minSeatsFilter, setMinSeatsFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const teamsData = useQuery(api.teams.list, {
    racingType:
      racingTypeFilter !== "all"
        ? (racingTypeFilter as "real-world" | "sim-racing" | "both")
        : undefined,
    location: locationFilter || undefined,
  })

  const allTeams = useMemo(() => {
    if (!teamsData) return []
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

  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    allTeams.forEach((team: any) => locations.add(team.location))
    return Array.from(locations).sort()
  }, [allTeams])

  const teams = useMemo(() => {
    let filtered = allTeams

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (team: any) =>
          team.name.toLowerCase().includes(query) ||
          team.location.toLowerCase().includes(query) ||
          team.description?.toString().toLowerCase().includes(query) ||
          team.specialties.some((spec: string) => spec.toLowerCase().includes(query)) ||
          team.requirements?.some((req: string) => req.toLowerCase().includes(query))
      )
    }

    if (minSeatsFilter !== "all") {
      const minSeats = Number.parseInt(minSeatsFilter, 10)
      filtered = filtered.filter((team: any) => team.availableSeats >= minSeats)
    }

    return filtered
  }, [allTeams, debouncedSearchQuery, minSeatsFilter])

  const paginatedTeams = teams.slice(0, page * ITEMS_PER_PAGE)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery, racingTypeFilter, locationFilter, minSeatsFilter])

  const hasActiveFilters =
    racingTypeFilter !== "all" ||
    debouncedSearchQuery.trim() !== "" ||
    locationFilter !== "" ||
    minSeatsFilter !== "all"

  const resetFilters = () => {
    setSearchQuery("")
    setLocationFilter("")
    setRacingTypeFilter("all")
    setMinSeatsFilter("all")
    setPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/motorsports">
        <Button className="mb-4" size="sm" variant="ghost">
          <ArrowLeft className="mr-2 size-4" />
          Motorsports Hub
        </Button>
      </Link>

      <MotorsportsNav />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-bold text-2xl">Teams</h1>
        <Button asChild size="sm">
          <Link href="/motorsports/profile/team">
            <Plus className="mr-2 size-4" />
            Post Your Team
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-4 pl-10"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams by name, location, specialties..."
            value={searchQuery}
          />
          {searchQuery && (
            <Button
              className="absolute top-1/2 right-2 -translate-y-1/2"
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
            {minSeatsFilter !== "all" && (
              <Badge className="gap-1" variant="secondary">
                {minSeatsFilter}+ Seats
                <button
                  aria-label="Remove minimum seats filter"
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
              if (teamsData === undefined) return "Loading teams..."
              const teamText = teams.length === 1 ? "team" : "teams"
              return `Showing ${paginatedTeams.length} of ${teams.length} ${teamText}`
            })()}
          </p>
        </div>

        {(() => {
          if (teamsData === undefined) {
            return (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <Skeleton className="size-12 rounded-lg" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <Skeleton className="h-6 w-3/4" />
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
            <>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {paginatedTeams.map((team: any) => (
                  <TeamCard key={team.id} {...team} />
                ))}
              </div>
              {paginatedTeams.length < teams.length && (
                <div className="flex justify-center pt-4">
                  <Button onClick={() => setPage((p) => p + 1)} variant="outline">
                    Load More ({teams.length - paginatedTeams.length} remaining)
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
