"use client"

import { useQuery } from "convex/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ArrowRight, Plus, Users } from "lucide-react"
import Link from "next/link"
import { api } from "@/lib/convex"

export default function MotorsportsPage() {
  // Fetch summary counts for featured section
  const teamsData = useQuery(api.teams.list, {})
  const driversData = useQuery(api.driverProfiles.list, {})

  const teamCount = teamsData?.length || 0
  const driverCount = driversData?.length || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="mb-2 font-bold text-3xl">Motorsports</h1>
        <p className="text-muted-foreground text-lg">
          Connect drivers with racing teams. Find your perfect match and accelerate your racing
          career.
        </p>
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

      {/* Main CTAs */}
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="group relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl">
          <CardContent className="p-8">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-8 text-primary" />
            </div>
            <h3 className="mb-2 font-bold text-2xl">Find a Team</h3>
            <p className="mb-6 text-muted-foreground">
              Browse racing teams looking for drivers. Filter by series, location, and requirements
              to find the perfect match.
            </p>
            <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
              <span>{teamCount} teams available</span>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link href="/motorsports/teams">
                Browse Teams
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-2 transition-all hover:scale-[1.02] hover:shadow-xl">
          <CardContent className="p-8">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <span className="text-4xl">🏎️</span>
            </div>
            <h3 className="mb-2 font-bold text-2xl">Find a Driver</h3>
            <p className="mb-6 text-muted-foreground">
              Discover talented drivers looking for team opportunities. Search by experience,
              licenses, and preferred racing categories.
            </p>
            <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
              <span>{driverCount} drivers available</span>
            </div>
            <Button asChild className="w-full" size="lg" variant="outline">
              <Link href="/motorsports/drivers">
                Browse Drivers
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create Profile CTAs */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Join the Network</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">
            Are you a driver looking for opportunities, or a team seeking talent? Create your
            profile to get started.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild className="flex-1" variant="outline">
              <Link href="/motorsports/profile/driver">
                <Plus className="mr-2 size-4" />
                Create Driver Profile
              </Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/motorsports/profile/team">
                <Plus className="mr-2 size-4" />
                Create Team Profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
