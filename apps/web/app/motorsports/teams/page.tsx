"use client"

import { useQuery } from "convex/react"
import { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { TeamCard } from "@/components/team-card"
import { api } from "@/lib/convex"

export default function TeamsPage() {
  // Fetch teams from database
  const teamsData = useQuery(api.teams.list, {})

  // Map teams data to the format expected by TeamCard
  const teams = useMemo(() => {
    if (!teamsData) return []
    return teamsData.map((team) => ({
      id: team._id as string,
      name: team.name,
      logoUrl: team.logoUrl,
      location: team.location,
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
        <Button className="mb-6" variant="ghost">
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

      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {teamsData === undefined
            ? "Loading teams..."
            : `Showing ${teams.length} ${teams.length === 1 ? "team" : "teams"}`}
        </p>
      </div>

      {teamsData === undefined ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
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
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id} className="flex h-full">
              <TeamCard {...team} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

