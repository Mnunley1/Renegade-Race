"use client"

import { useQuery } from "convex/react"
import { useMemo } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Plus } from "lucide-react"
import Link from "next/link"
import { DriverCard } from "@/components/driver-card"
import { TeamCard } from "@/components/team-card"
import { api } from "@/lib/convex"

export default function MotorsportsPage() {
  // Fetch teams and drivers from database
  const teamsData = useQuery(api.teams.list, {})
  const driversData = useQuery(api.driverProfiles.list, {})

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

  // Map drivers data to the format expected by DriverCard
  const drivers = useMemo(() => {
    if (!driversData) return []
    return driversData.map((driver) => ({
      id: driver._id as string,
      name: driver.user?.name || 'Unknown Driver',
      avatarUrl: driver.user?.avatarUrl,
      location: driver.location,
      experience: driver.experience,
      licenses: driver.licenses,
      preferredCategories: driver.preferredCategories,
      bio: driver.bio,
    }))
  }, [driversData])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 font-bold text-3xl">Motorsports</h1>
          <p className="text-muted-foreground">Connect with racing teams and drivers</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/motorsports/profile/driver">
            <Button className="w-full sm:w-auto" variant="outline">
              <Plus className="mr-2 size-4" />
              Create Driver Profile
            </Button>
          </Link>
          <Link href="/motorsports/profile/team">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              Create Team Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero/Info Section */}
      <div className="mb-12 space-y-8">
        <Card className="overflow-hidden border-2 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardContent className="p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div className="space-y-4">
                <Badge className="px-4 py-1 text-sm">🏎️ Motorsports Network</Badge>
                <h2 className="font-bold text-3xl md:text-4xl">
                  Connect Drivers with Racing Teams
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Renegade Motorsports is the premier platform connecting talented drivers with
                  professional racing teams. Whether you're a seasoned professional or an
                  up-and-coming driver, find your perfect match and accelerate your racing career.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <span className="text-9xl">🏁</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Section */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                🏁
              </div>
              <CardTitle>For Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Discover racing opportunities with verified teams</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Showcase your experience and achievements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Connect directly with team owners</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                ⚡
              </div>
              <CardTitle>For Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Find qualified drivers matching your requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Review driver profiles and credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Streamline your recruitment process</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                🔄
              </div>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Create your profile (driver or team)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>Browse available opportunities or candidates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Connect and take your racing to the next level</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs className="w-full" defaultValue="teams">
        <TabsList className="mb-8">
          <TabsTrigger value="teams">Teams Looking for Drivers ({teams.length})</TabsTrigger>
          <TabsTrigger value="drivers">Drivers Looking for Teams ({drivers.length})</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-8" value="teams">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Showing {teams.length} teams</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <div key={team.id} className="flex h-full">
                <TeamCard {...team} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent className="mt-8" value="drivers">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-muted-foreground text-sm">Showing {drivers.length} drivers</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex h-full">
                <DriverCard {...driver} />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
