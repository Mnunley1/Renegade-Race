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
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { TeamCard } from "@/components/team-card"
import { api } from "@/lib/convex"

export default function TeamsPage() {
  const [racingTypeFilter, setRacingTypeFilter] = useState<string>("all")

  // Fetch teams from database
  const teamsData = useQuery(api.teams.list, {
    racingType:
      racingTypeFilter !== "all"
        ? (racingTypeFilter as "real-world" | "sim-racing" | "both")
        : undefined,
  })

  // Map teams data to the format expected by TeamCard
  const teams = useMemo(() => {
    if (!teamsData) {
      return []
    }
    return teamsData.map((team) => ({
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
          <h1 className="mb-2 font-bold text-3xl">Racing Teams</h1>
          <p className="text-muted-foreground">
            Browse teams looking for drivers. Find the perfect opportunity to join a professional
            racing team.
          </p>
        </div>
        <Link href="/motorsports/profile/team">
          <Button>
            <Plus className="mr-2 size-4" />
            Post Your Team
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {(() => {
            if (teamsData === undefined) {
              return "Loading teams..."
            }
            const teamText = teams.length === 1 ? "team" : "teams"
            return `Showing ${teams.length} ${teamText}`
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
            {teams.map((team) => (
              <TeamCard key={team.id} {...team} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
